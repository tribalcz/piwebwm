use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{NetworkAddress, NetworkInterface, NetworkStatus, RouteEntry, WifiNetwork};
use log::info;
use serde::Deserialize;
use std::fs;

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

        let stat = |kind: &str| read_u64(&format!("/sys/class/net/{}/statistics/{}", e.ifname, kind));
        result.push(NetworkInterface {
            kind: classify(&e.ifname),
            state: e.operstate.unwrap_or_else(|| "unknown".to_string()).to_lowercase(),
            mac: e.address,
            addresses,
            rx_bytes: stat("rx_bytes"),
            tx_bytes: stat("tx_bytes"),
            speed_mbps: read_speed(&e.ifname),
            mtu: read_u64(&format!("/sys/class/net/{}/mtu", e.ifname)) as u32,
            rx_errors: stat("rx_errors"),
            tx_errors: stat("tx_errors"),
            rx_dropped: stat("rx_dropped"),
            tx_dropped: stat("tx_dropped"),
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

/// Desired IPv4/IPv6 configuration for an interface.
pub struct InterfaceConfig {
    pub iface: String,
    pub method: String, // "auto" | "manual"
    pub address: Option<String>,
    pub prefixlen: Option<u8>,
    pub gateway: Option<String>,
    pub dns: Option<Vec<String>>,
    pub dns_search: Option<Vec<String>>,
    // IPv6: None = leave untouched.
    pub ipv6_method: Option<String>, // "auto" | "manual" | "disabled" | "ignore"
    pub ipv6_address: Option<String>,
    pub ipv6_prefixlen: Option<u8>,
    pub ipv6_gateway: Option<String>,
}

/// Snapshot of a connection's IPv4 + IPv6 settings, used to revert.
#[derive(Clone, Debug)]
pub struct PrevConfig {
    pub con: String,
    pub method: String,
    pub addresses: String,
    pub gateway: String,
    pub dns: String,
    pub dns_search: String,
    pub ip6_method: String,
    pub ip6_addresses: String,
    pub ip6_gateway: String,
    pub ip6_dns: String,
}

pub(crate) fn valid_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 4 && parts.iter().all(|p| {
        !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit())
            && p.parse::<u16>().map(|n| n <= 255).unwrap_or(false)
    })
}

/// Lightweight IPv6 literal check: hex groups, ':' and (for embedded v4) '.'.
/// nmcli does the authoritative parsing; this just blocks anything that could
/// be read as a flag or shell-unsafe input.
pub(crate) fn valid_ipv6(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 45
        && s.contains(':')
        && s.chars().all(|c| c.is_ascii_hexdigit() || matches!(c, ':' | '.' | '%'))
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
        &[
            "-g",
            "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns,ipv4.dns-search,\
             ipv6.method,ipv6.addresses,ipv6.gateway,ipv6.dns",
            "con", "show", con,
        ],
    )?;
    let lines: Vec<&str> = out.lines().collect();
    let at = |i: usize| lines.get(i).unwrap_or(&"").trim().to_string();
    Ok(PrevConfig {
        con: con.to_string(),
        method: lines.first().map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("auto").to_string(),
        addresses: at(1),
        gateway: at(2),
        dns: at(3),
        dns_search: at(4),
        ip6_method: lines.get(5).map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("auto").to_string(),
        ip6_addresses: at(6),
        ip6_gateway: at(7),
        ip6_dns: at(8),
    })
}

/// Applies the desired config and returns the previous one (for revert).
pub fn apply_interface_config(cfg: &InterfaceConfig) -> Result<PrevConfig> {
    // Validate first — never pass unchecked input to nmcli.
    //
    // DNS / search semantics: `None` means "leave the existing value
    // untouched"; `Some(list)` overwrites it (an empty list clears it). This
    // way a plain IP change never silently wipes pre-existing DNS or search
    // domains the caller didn't intend to touch.
    //
    // A single DNS list may carry both IPv4 and IPv6 servers; they are routed
    // to ipv4.dns / ipv6.dns by family so the caller doesn't manage two fields.
    let (dns4_joined, dns6_joined) = match &cfg.dns {
        Some(list) => {
            let mut v4 = Vec::new();
            let mut v6 = Vec::new();
            for d in list {
                if valid_ipv4(d) {
                    v4.push(d.clone());
                } else if valid_ipv6(d) {
                    v6.push(d.clone());
                } else {
                    return Err(AgentError::InvalidRequest(format!("invalid DNS server: {}", d)));
                }
            }
            (Some(v4.join(" ")), Some(v6.join(" ")))
        }
        None => (None, None),
    };

    // Search domains are validated lightly (no whitespace; nmcli rejects the rest).
    let search_joined = match &cfg.dns_search {
        Some(list) => {
            for d in list {
                if d.contains(char::is_whitespace) {
                    return Err(AgentError::InvalidRequest(format!("invalid search domain: {}", d)));
                }
            }
            Some(list.join(" "))
        }
        None => None,
    };

    let con = con_for_iface(&cfg.iface)?;
    let prev = capture_prev(&con)?;

    // Build the `con mod` argument vector dynamically so that fields the caller
    // didn't specify (DNS / search / IPv6) are simply omitted rather than cleared.
    let mut args: Vec<String> = vec!["con".into(), "mod".into(), con.clone()];

    match cfg.method.as_str() {
        "auto" => {
            args.extend([
                "ipv4.method".into(), "auto".into(),
                "ipv4.addresses".into(), "".into(),
                "ipv4.gateway".into(), "".into(),
            ]);
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
            args.extend([
                "ipv4.method".into(), "manual".into(),
                "ipv4.addresses".into(), cidr,
                "ipv4.gateway".into(), gateway.to_string(),
            ]);
        }
        other => {
            return Err(AgentError::InvalidRequest(format!("unknown method: {}", other)));
        }
    }

    // IPv6 — only touched when ipv6_method is provided.
    if let Some(m) = cfg.ipv6_method.as_deref() {
        match m {
            "auto" | "disabled" | "ignore" => {
                args.extend([
                    "ipv6.method".into(), m.to_string(),
                    "ipv6.addresses".into(), "".into(),
                    "ipv6.gateway".into(), "".into(),
                ]);
            }
            "manual" => {
                let address = cfg.ipv6_address.as_deref().unwrap_or("");
                let prefix = cfg.ipv6_prefixlen.unwrap_or(64);
                if !valid_ipv6(address) {
                    return Err(AgentError::InvalidRequest("invalid IPv6 address".to_string()));
                }
                if prefix > 128 {
                    return Err(AgentError::InvalidRequest("invalid IPv6 prefix length".to_string()));
                }
                let gateway = cfg.ipv6_gateway.as_deref().unwrap_or("");
                if !gateway.is_empty() && !valid_ipv6(gateway) {
                    return Err(AgentError::InvalidRequest("invalid IPv6 gateway".to_string()));
                }
                let cidr = format!("{}/{}", address, prefix);
                args.extend([
                    "ipv6.method".into(), "manual".into(),
                    "ipv6.addresses".into(), cidr,
                    "ipv6.gateway".into(), gateway.to_string(),
                ]);
            }
            other => {
                return Err(AgentError::InvalidRequest(format!("unknown IPv6 method: {}", other)));
            }
        }
    }

    if let Some(dns) = &dns4_joined {
        args.extend(["ipv4.dns".into(), dns.clone()]);
    }
    if let Some(dns) = &dns6_joined {
        args.extend(["ipv6.dns".into(), dns.clone()]);
    }
    if let Some(search) = &search_joined {
        args.extend(["ipv4.dns-search".into(), search.clone()]);
    }

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run("nmcli", &arg_refs)?;

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
        "ipv4.dns-search", &prev.dns_search,
        "ipv6.method", &prev.ip6_method,
        "ipv6.addresses", &prev.ip6_addresses,
        "ipv6.gateway", &prev.ip6_gateway,
        "ipv6.dns", &prev.ip6_dns,
    ])?;
    run("nmcli", &["con", "up", &prev.con])?;
    info!("Reverted network config on {}", prev.con);
    Ok(())
}

fn valid_cidr(s: &str) -> bool {
    match s.split_once('/') {
        Some((ip, prefix)) => valid_ipv4(ip) && prefix.parse::<u8>().map(|p| p <= 32).unwrap_or(false),
        None => false,
    }
}

/// Builds the nmcli route value ("dst" or "dst gw").
fn route_value(dst: &str, gateway: &Option<String>) -> Result<String> {
    if !valid_cidr(dst) {
        return Err(AgentError::InvalidRequest(format!("invalid route destination (use CIDR): {}", dst)));
    }
    match gateway {
        Some(gw) if !gw.is_empty() => {
            if !valid_ipv4(gw) {
                return Err(AgentError::InvalidRequest(format!("invalid gateway: {}", gw)));
            }
            Ok(format!("{} {}", dst, gw))
        }
        _ => Ok(dst.to_string()),
    }
}

pub fn add_route(iface: &str, dst: &str, gateway: &Option<String>) -> Result<()> {
    let value = route_value(dst, gateway)?;
    let con = con_for_iface(iface)?;
    run("nmcli", &["con", "mod", &con, "+ipv4.routes", &value])?;
    run("nmcli", &["con", "up", &con])?;
    info!("Added route {} on {}", value, con);
    Ok(())
}

pub fn delete_route(iface: &str, dst: &str, gateway: &Option<String>) -> Result<()> {
    let value = route_value(dst, gateway)?;
    let con = con_for_iface(iface)?;
    run("nmcli", &["con", "mod", &con, "-ipv4.routes", &value])?;
    run("nmcli", &["con", "up", &con])?;
    info!("Deleted route {} on {}", value, con);
    Ok(())
}

// --- Interface link controls (runtime) -------------------------------------

/// A safe interface name: 1–15 chars, alphanumeric plus '.', '-', '_', '@'
/// (covers vlan/bridge/altname forms). Rejects anything that could be read as
/// a flag or shell metacharacter.
fn valid_iface(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && !name.starts_with('-')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '@'))
}

pub fn set_interface_state(iface: &str, up: bool) -> Result<()> {
    if !valid_iface(iface) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    run("ip", &["link", "set", iface, if up { "up" } else { "down" }])?;
    info!("Set interface {} {}", iface, if up { "up" } else { "down" });
    Ok(())
}

pub fn set_mtu(iface: &str, mtu: u32) -> Result<()> {
    if !valid_iface(iface) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    if !(576..=9216).contains(&mtu) {
        return Err(AgentError::InvalidRequest("MTU out of range (576–9216)".to_string()));
    }
    run("ip", &["link", "set", iface, "mtu", &mtu.to_string()])?;
    info!("Set MTU of {} to {}", iface, mtu);
    Ok(())
}

/// Returns the active DHCPv4/DHCPv6 lease options for an interface's connection,
/// as reported by NetworkManager (human-readable multi-line text).
pub fn dhcp_lease(iface: &str) -> Result<String> {
    if !valid_iface(iface) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    let con = con_for_iface(iface)?;
    // `-f DHCP4.OPTION` prints one labelled "key = value" line per option.
    let v4 = run("nmcli", &["-f", "DHCP4.OPTION", "con", "show", &con]).unwrap_or_default();
    let v6 = run("nmcli", &["-f", "DHCP6.OPTION", "con", "show", &con]).unwrap_or_default();

    let mut out = String::new();
    let v4 = v4.trim();
    let v6 = v6.trim();
    if !v4.is_empty() {
        out.push_str(v4);
    }
    if !v6.is_empty() {
        if !out.is_empty() {
            out.push_str("\n\n");
        }
        out.push_str(v6);
    }
    if out.is_empty() {
        out = "No DHCP lease — the interface is likely using a static address.".to_string();
    }
    Ok(out)
}

// --- Wi-Fi management ------------------------------------------------------

/// SSID validation: 1–32 bytes, no control characters. SSIDs can contain most
/// printable characters, so we only reject control bytes and over-length names.
fn valid_ssid(ssid: &str) -> bool {
    !ssid.is_empty()
        && ssid.len() <= 32
        && !ssid.starts_with('-') // never read as an nmcli flag
        && !ssid.chars().any(|c| c.is_control())
}

pub fn wifi_scan(iface: &str) -> Result<Vec<WifiNetwork>> {
    if !valid_iface(iface) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    // Terse, colon-separated output. Escaped colons inside fields are rendered
    // as "\:" by nmcli, so we unescape them after splitting on unescaped ':'.
    let out = run(
        "nmcli",
        &["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "ifname", iface],
    )?;

    let mut nets = Vec::new();
    for line in out.lines() {
        let fields = split_nmcli_terse(line);
        if fields.len() < 4 {
            continue;
        }
        let ssid = fields[1].clone();
        if ssid.is_empty() {
            continue; // hidden network
        }
        let security = fields[3].trim().to_string();
        nets.push(WifiNetwork {
            in_use: fields[0].trim() == "*",
            ssid,
            signal: fields[2].trim().parse::<u8>().unwrap_or(0),
            security: if security.is_empty() { "open".to_string() } else { security },
        });
    }
    Ok(nets)
}

/// Splits one line of nmcli `-t` terse output on unescaped ':' and unescapes.
fn split_nmcli_terse(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut cur = String::new();
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next) = chars.peek() {
                cur.push(next);
                chars.next();
            }
        } else if c == ':' {
            fields.push(std::mem::take(&mut cur));
        } else {
            cur.push(c);
        }
    }
    fields.push(cur);
    fields
}

pub fn wifi_connect(iface: &str, ssid: &str, password: &Option<String>) -> Result<()> {
    if !valid_iface(iface) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    if !valid_ssid(ssid) {
        return Err(AgentError::InvalidRequest("invalid SSID".to_string()));
    }
    // SSID/password travel as fixed positional args (no shell), so even values
    // with spaces or metacharacters are safe.
    let mut args: Vec<&str> = vec!["device", "wifi", "connect", ssid, "ifname", iface];
    if let Some(pw) = password {
        if !pw.is_empty() {
            args.push("password");
            args.push(pw);
        }
    }
    run("nmcli", &args)?;
    info!("Connected {} to Wi-Fi SSID", iface);
    Ok(())
}

pub fn wifi_forget(ssid: &str) -> Result<()> {
    if !valid_ssid(ssid) {
        return Err(AgentError::InvalidRequest("invalid SSID".to_string()));
    }
    // The saved connection profile is usually named after the SSID.
    run("nmcli", &["con", "delete", ssid])?;
    info!("Forgot Wi-Fi network");
    Ok(())
}

// --- Diagnostics -----------------------------------------------------------

/// A host argument for diagnostics: IPv4/IPv6 literal or DNS name. Rejects
/// anything that could be read as a flag or contains shell-unsafe characters.
fn valid_host(host: &str) -> bool {
    !host.is_empty()
        && host.len() <= 255
        && !host.starts_with('-')
        && host.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '_'))
}

pub fn ping4(host: &str, count: u8) -> Result<String> {
    if !valid_host(host) {
        return Err(AgentError::InvalidRequest("invalid host".to_string()));
    }
    let n = count.clamp(1, 10).to_string();
    // -w caps total time so a request can't hang the agent.
    run("ping", &["-4", "-c", &n, "-w", "15", host])
}

pub fn traceroute(host: &str) -> Result<String> {
    if !valid_host(host) {
        return Err(AgentError::InvalidRequest("invalid host".to_string()));
    }
    // Cap hops and per-hop wait to bound runtime.
    run("traceroute", &["-4", "-m", "20", "-w", "2", host])
}

pub fn dns_lookup(host: &str) -> Result<String> {
    if !valid_host(host) {
        return Err(AgentError::InvalidRequest("invalid host".to_string()));
    }
    run("getent", &["hosts", host])
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
