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

// --- NetworkManager configuration (phase 2: interface IP/gateway/DNS) -------

use std::sync::atomic::{AtomicU64, Ordering};

/// Desired IPv4 configuration for an interface.
pub struct InterfaceConfig {
    pub iface: String,
    pub method: String, // "auto" | "manual"
    pub address: Option<String>,
    pub prefixlen: Option<u8>,
    pub gateway: Option<String>,
    pub dns: Option<Vec<String>>,
}

/// Snapshot of a connection's IPv4 settings, used to revert.
#[derive(Clone, Debug)]
pub struct PrevConfig {
    pub con: String,
    pub method: String,
    pub addresses: String,
    pub gateway: String,
    pub dns: String,
}

fn valid_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 4 && parts.iter().all(|p| {
        !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit())
            && p.parse::<u16>().map(|n| n <= 255).unwrap_or(false)
    })
}

/// Resolve the active NetworkManager connection name bound to an interface.
fn con_for_iface(iface: &str) -> Result<String> {
    let out = run("nmcli", &["-g", "GENERAL.CONNECTION", "device", "show", iface])?;
    let con = out.trim().to_string();
    if con.is_empty() {
        return Err(AgentError::InvalidRequest(format!(
            "interface {} has no active connection",
            iface
        )));
    }
    Ok(con)
}

fn capture_prev(con: &str) -> Result<PrevConfig> {
    // -g with multiple fields prints one value per line, in order.
    let out = run(
        "nmcli",
        &["-g", "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns", "con", "show", con],
    )?;
    let lines: Vec<&str> = out.lines().collect();
    Ok(PrevConfig {
        con: con.to_string(),
        method: lines.first().unwrap_or(&"auto").trim().to_string(),
        addresses: lines.get(1).unwrap_or(&"").trim().to_string(),
        gateway: lines.get(2).unwrap_or(&"").trim().to_string(),
        dns: lines.get(3).unwrap_or(&"").trim().to_string(),
    })
}

/// Applies the desired config and returns the previous one (for revert).
pub fn apply_interface_config(cfg: &InterfaceConfig) -> Result<PrevConfig> {
    // Validate first — never pass unchecked input to nmcli.
    let dns_joined = match &cfg.dns {
        Some(list) => {
            for d in list {
                if !valid_ipv4(d) {
                    return Err(AgentError::InvalidRequest(format!("invalid DNS server: {}", d)));
                }
            }
            list.join(" ")
        }
        None => String::new(),
    };

    let con = con_for_iface(&cfg.iface)?;
    let prev = capture_prev(&con)?;

    match cfg.method.as_str() {
        "auto" => {
            run("nmcli", &[
                "con", "mod", &con,
                "ipv4.method", "auto",
                "ipv4.addresses", "",
                "ipv4.gateway", "",
                "ipv4.dns", &dns_joined,
            ])?;
        }
        "manual" => {
            let address = cfg.address.as_deref().unwrap_or("");
            let prefix = cfg.prefixlen.unwrap_or(24);
            if !valid_ipv4(address) {
                return Err(AgentError::InvalidRequest("invalid IPv4 address".to_string()));
            }
            if prefix > 32 {
                return Err(AgentError::InvalidRequest("invalid prefix length".to_string()));
            }
            let gateway = cfg.gateway.as_deref().unwrap_or("");
            if !gateway.is_empty() && !valid_ipv4(gateway) {
                return Err(AgentError::InvalidRequest("invalid gateway".to_string()));
            }
            let cidr = format!("{}/{}", address, prefix);
            run("nmcli", &[
                "con", "mod", &con,
                "ipv4.method", "manual",
                "ipv4.addresses", &cidr,
                "ipv4.gateway", gateway,
                "ipv4.dns", &dns_joined,
            ])?;
        }
        other => {
            return Err(AgentError::InvalidRequest(format!("unknown method: {}", other)));
        }
    }

    run("nmcli", &["con", "up", &con])?;
    info!("Applied network config to {} ({})", cfg.iface, cfg.method);
    Ok(prev)
}

/// Restores a previously captured configuration.
pub fn restore_interface_config(prev: &PrevConfig) -> Result<()> {
    run("nmcli", &[
        "con", "mod", &prev.con,
        "ipv4.method", &prev.method,
        "ipv4.addresses", &prev.addresses,
        "ipv4.gateway", &prev.gateway,
        "ipv4.dns", &prev.dns,
    ])?;
    run("nmcli", &["con", "up", &prev.con])?;
    info!("Reverted network config on {}", prev.con);
    Ok(())
}

static TOKEN_COUNTER: AtomicU64 = AtomicU64::new(0);

/// A non-cryptographic, unique token for a pending revert.
pub fn gen_token() -> String {
    let n = TOKEN_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("rv-{}-{}", nanos, n)
}
