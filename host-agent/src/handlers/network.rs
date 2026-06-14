use crate::error::{AgentError, Result};
use crate::protocol::{NetworkAddress, NetworkInterface, NetworkStatus, RouteEntry};
use log::info;
use serde::Deserialize;
use std::fs;
use std::process::Command;

// --- iproute2 JSON shapes (subset of `ip -j addr` / `ip -j route`) ----------

#[derive(Deserialize)]
struct IpAddrEntry {
    ifname: String,
    #[serde(default)]
    address: Option<String>, // MAC
    #[serde(default)]
    operstate: Option<String>,
    #[serde(default)]
    addr_info: Vec<IpAddrInfo>,
}

#[derive(Deserialize)]
struct IpAddrInfo {
    family: String, // "inet" | "inet6"
    local: String,
    prefixlen: u8,
}

#[derive(Deserialize)]
struct IpRouteEntry {
    #[serde(default)]
    dst: Option<String>,
    #[serde(default)]
    gateway: Option<String>,
    #[serde(default)]
    dev: Option<String>,
    #[serde(default)]
    protocol: Option<String>,
}

/// Runs a fixed command with a fixed argument vector (no shell → no injection).
fn run(cmd: &str, args: &[&str]) -> Result<String> {
    let output = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| AgentError::Internal(format!("failed to run {}: {}", cmd, e)))?;
    if !output.status.success() {
        return Err(AgentError::Internal(format!(
            "{} failed: {}",
            cmd,
            String::from_utf8_lossy(&output.stderr).trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn read_u64(path: &str) -> u64 {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or(0)
}

fn classify(ifname: &str) -> String {
    if ifname == "lo" {
        return "loopback".to_string();
    }
    if fs::metadata(format!("/sys/class/net/{}/wireless", ifname)).is_ok() {
        return "wifi".to_string();
    }
    if fs::metadata(format!("/sys/class/net/{}/device", ifname)).is_ok() {
        return "ethernet".to_string();
    }
    "other".to_string()
}

fn read_speed(ifname: &str) -> Option<i64> {
    fs::read_to_string(format!("/sys/class/net/{}/speed", ifname))
        .ok()
        .and_then(|s| s.trim().parse::<i64>().ok())
        .filter(|&v| v > 0)
}

pub fn network_interfaces() -> Result<Vec<NetworkInterface>> {
    info!("Reading network interfaces");
    let out = run("ip", &["-j", "addr"])?;
    let entries: Vec<IpAddrEntry> = serde_json::from_str(&out)
        .map_err(|e| AgentError::Internal(format!("failed to parse `ip -j addr`: {}", e)))?;

    let mut result = Vec::new();
    for e in entries {
        let addresses = e
            .addr_info
            .iter()
            .map(|a| NetworkAddress {
                family: match a.family.as_str() {
                    "inet" => "ipv4".to_string(),
                    "inet6" => "ipv6".to_string(),
                    other => other.to_string(),
                },
                address: a.local.clone(),
                prefixlen: a.prefixlen,
            })
            .collect();

        result.push(NetworkInterface {
            kind: classify(&e.ifname),
            state: e.operstate.unwrap_or_else(|| "unknown".to_string()).to_lowercase(),
            mac: e.address,
            addresses,
            rx_bytes: read_u64(&format!("/sys/class/net/{}/statistics/rx_bytes", e.ifname)),
            tx_bytes: read_u64(&format!("/sys/class/net/{}/statistics/tx_bytes", e.ifname)),
            speed_mbps: read_speed(&e.ifname),
            name: e.ifname,
        });
    }
    Ok(result)
}

pub fn routing_table() -> Result<Vec<RouteEntry>> {
    info!("Reading routing table");
    let out = run("ip", &["-j", "route"])?;
    let entries: Vec<IpRouteEntry> = serde_json::from_str(&out)
        .map_err(|e| AgentError::Internal(format!("failed to parse `ip -j route`: {}", e)))?;

    Ok(entries
        .into_iter()
        .map(|r| RouteEntry {
            dst: r.dst.unwrap_or_else(|| "default".to_string()),
            gateway: r.gateway,
            dev: r.dev.unwrap_or_default(),
            protocol: r.protocol,
        })
        .collect())
}

fn read_dns() -> Vec<String> {
    fs::read_to_string("/etc/resolv.conf")
        .map(|content| {
            content
                .lines()
                .filter_map(|line| {
                    let line = line.trim();
                    line.strip_prefix("nameserver ").map(|s| s.trim().to_string())
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn network_status() -> Result<NetworkStatus> {
    info!("Reading network status");
    let hostname = nix::unistd::gethostname()
        .map_err(|e| AgentError::Internal(format!("gethostname failed: {}", e)))?
        .to_string_lossy()
        .to_string();

    let routes = routing_table().unwrap_or_default();
    let gateway = routes
        .iter()
        .find(|r| r.dst == "default")
        .and_then(|r| r.gateway.clone());

    let online = gateway.is_some();

    Ok(NetworkStatus {
        hostname,
        gateway,
        dns: read_dns(),
        online,
    })
}

/// A valid hostname label: 1–63 chars, alphanumeric or '-', not starting/ending with '-'.
fn valid_hostname(name: &str) -> bool {
    if name.is_empty() || name.len() > 63 {
        return false;
    }
    if name.starts_with('-') || name.ends_with('-') {
        return false;
    }
    name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

pub fn set_hostname(name: &str) -> Result<()> {
    if !valid_hostname(name) {
        return Err(AgentError::InvalidRequest(
            "invalid hostname (use 1–63 letters, digits or dashes)".to_string(),
        ));
    }
    info!("Setting hostname to {}", name);
    run("hostnamectl", &["set-hostname", name])?;
    Ok(())
}
