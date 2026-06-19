//! Read-only system information: a static overview (device, OS, kernel, uptime,
//! CPU temperature) and live resource counters (CPU, memory, swap, disks).
//!
//! CPU utilisation is intentionally returned as raw /proc/stat counters rather
//! than a percentage: the frontend already polls on an interval and computes
//! the rate from deltas (as it does for network throughput), which avoids
//! blocking an agent worker on a sampling sleep.

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{DiskUsage, Resources, SystemOverview};
use std::fs;

fn read_trimmed(path: &str) -> Option<String> {
    fs::read_to_string(path).ok().map(|s| s.trim_end_matches(['\0', '\n', ' ']).trim().to_string())
}

/// Reads a `KEY=value` / `KEY="value"` file (os-release style) into a lookup.
fn parse_kv(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        if let Some((k, v)) = line.split_once('=') {
            if k.trim() == key {
                return Some(v.trim().trim_matches('"').to_string());
            }
        }
    }
    None
}

fn device_model() -> String {
    // The device-tree model is the most descriptive on a Pi; it's a
    // null-terminated string, so trim trailing NULs.
    read_trimmed("/proc/device-tree/model")
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown device".to_string())
}

fn cpu_info() -> (String, u32) {
    let content = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let mut model = String::new();
    let mut cores = 0u32;
    for line in content.lines() {
        if line.starts_with("processor") {
            cores += 1;
        } else if model.is_empty() {
            if let Some((k, v)) = line.split_once(':') {
                let k = k.trim();
                if k == "model name" || k == "Model name" || k == "Hardware" {
                    model = v.trim().to_string();
                }
            }
        }
    }
    if model.is_empty() {
        model = "Unknown CPU".to_string();
    }
    (model, cores.max(1))
}

fn cpu_temp_c() -> Option<f64> {
    read_trimmed("/sys/class/thermal/thermal_zone0/temp")
        .and_then(|s| s.parse::<f64>().ok())
        .map(|milli| milli / 1000.0)
}

pub fn get_system_overview() -> Result<SystemOverview> {
    let os = fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|c| parse_kv(&c, "PRETTY_NAME"))
        .unwrap_or_else(|| "Unknown OS".to_string());

    let kernel = read_trimmed("/proc/sys/kernel/osrelease").unwrap_or_default();
    let arch = run("uname", &["-m"]).map(|s| s.trim().to_string()).unwrap_or_default();
    let hostname = read_trimmed("/proc/sys/kernel/hostname").unwrap_or_default();

    let uptime_secs = read_trimmed("/proc/uptime")
        .and_then(|s| s.split_whitespace().next().map(|t| t.to_string()))
        .and_then(|t| t.parse::<f64>().ok())
        .map(|f| f as u64)
        .unwrap_or(0);

    let (cpu_model, cpu_cores) = cpu_info();

    Ok(SystemOverview {
        device: device_model(),
        os,
        kernel,
        arch,
        hostname,
        uptime_secs,
        cpu_temp_c: cpu_temp_c(),
        cpu_model,
        cpu_cores,
    })
}

/// Sums /proc/stat's aggregate cpu line into (total, idle) jiffies.
fn cpu_counters() -> (u64, u64) {
    let content = fs::read_to_string("/proc/stat").unwrap_or_default();
    if let Some(line) = content.lines().find(|l| l.starts_with("cpu ")) {
        let nums: Vec<u64> = line.split_whitespace().skip(1).filter_map(|t| t.parse().ok()).collect();
        // Fields: user nice system idle iowait irq softirq steal ...
        let total: u64 = nums.iter().sum();
        let idle = nums.get(3).copied().unwrap_or(0) + nums.get(4).copied().unwrap_or(0);
        return (total, idle);
    }
    (0, 0)
}

fn meminfo() -> (u64, u64, u64, u64) {
    let content = fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let kb = |key: &str| -> u64 {
        content
            .lines()
            .find(|l| l.starts_with(key))
            .and_then(|l| l.split_whitespace().nth(1))
            .and_then(|v| v.parse::<u64>().ok())
            .map(|v| v * 1024)
            .unwrap_or(0)
    };
    let mem_total = kb("MemTotal:");
    let mem_avail = kb("MemAvailable:");
    let swap_total = kb("SwapTotal:");
    let swap_free = kb("SwapFree:");
    (mem_total, mem_total.saturating_sub(mem_avail), swap_total, swap_total.saturating_sub(swap_free))
}

fn disks() -> Vec<DiskUsage> {
    // Portable 1K-block output, excluding pseudo filesystems.
    let out = match run(
        "df",
        &["-Pk", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay", "-x", "squashfs"],
    ) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let mut result = Vec::new();
    for line in out.lines().skip(1) {
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 6 {
            continue;
        }
        let total = f[1].parse::<u64>().unwrap_or(0) * 1024;
        let used = f[2].parse::<u64>().unwrap_or(0) * 1024;
        // Mount point is the remainder (it can, rarely, contain spaces).
        let mount = f[5..].join(" ");
        if total == 0 {
            continue;
        }
        result.push(DiskUsage { mount, total, used });
    }
    result
}

pub fn get_resources() -> Result<Resources> {
    let (cpu_total, cpu_idle) = cpu_counters();
    if cpu_total == 0 {
        return Err(AgentError::Internal("failed to read /proc/stat".to_string()));
    }

    let load: Vec<f64> = read_trimmed("/proc/loadavg")
        .map(|s| s.split_whitespace().take(3).filter_map(|t| t.parse().ok()).collect())
        .unwrap_or_default();

    let (mem_total, mem_used, swap_total, swap_used) = meminfo();
    let (_, cpu_cores) = cpu_info();

    Ok(Resources {
        cpu_total,
        cpu_idle,
        load1: load.first().copied().unwrap_or(0.0),
        load5: load.get(1).copied().unwrap_or(0.0),
        load15: load.get(2).copied().unwrap_or(0.0),
        cpu_cores,
        mem_total,
        mem_used,
        swap_total,
        swap_used,
        disks: disks(),
    })
}
