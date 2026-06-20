//! WireGuard VPN management: status (interfaces + peers), bring interfaces
//! up/down via wg-quick, and import/remove named configs under /etc/wireguard.

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{WgInterface, WgPeer};
use log::info;
use std::fs;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;

const WG_DIR: &str = "/etc/wireguard";

fn installed() -> bool {
    std::path::Path::new("/usr/bin/wg").exists() || std::path::Path::new("/usr/bin/wg-quick").exists()
}

/// A WireGuard interface/config name: 1–15 chars, alphanumeric plus '-'/'_'.
/// (Used both as the config filename and the link name.)
fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

fn configured_interfaces() -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(WG_DIR) {
        for e in entries.flatten() {
            let path = e.path();
            if path.extension().and_then(|x| x.to_str()) == Some("conf") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.sort();
    names
}

pub fn wireguard_status() -> Result<Vec<WgInterface>> {
    if !installed() {
        return Ok(Vec::new());
    }

    let up: Vec<String> = run("wg", &["show", "interfaces"])
        .unwrap_or_default()
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    // `wg show all dump` is tab-separated and machine-readable. The first line
    // per interface (5 fields) describes the interface; following 9-field lines
    // are its peers.
    let dump = run("wg", &["show", "all", "dump"]).unwrap_or_default();
    let mut peers_by_iface: std::collections::HashMap<String, Vec<WgPeer>> =
        std::collections::HashMap::new();
    for line in dump.lines() {
        let f: Vec<&str> = line.split('\t').collect();
        if f.len() >= 8 {
            // peer line: iface pubkey psk endpoint allowed-ips handshake rx tx [keepalive]
            let iface = f[0].to_string();
            let endpoint = if f[3] == "(none)" { String::new() } else { f[3].to_string() };
            peers_by_iface.entry(iface).or_default().push(WgPeer {
                endpoint,
                latest_handshake: f[5].parse::<i64>().unwrap_or(0),
                rx: f[6].parse::<u64>().unwrap_or(0),
                tx: f[7].parse::<u64>().unwrap_or(0),
            });
        }
    }

    // Union of configured and currently-up interfaces.
    let mut names = configured_interfaces();
    for u in &up {
        if !names.contains(u) {
            names.push(u.clone());
        }
    }

    let mut result = Vec::new();
    for name in names {
        result.push(WgInterface {
            up: up.contains(&name),
            peers: peers_by_iface.remove(&name).unwrap_or_default(),
            name,
        });
    }
    Ok(result)
}

pub fn set_interface(name: &str, up: bool) -> Result<()> {
    if !installed() {
        return Err(AgentError::InvalidRequest("wireguard is not installed".to_string()));
    }
    if !valid_name(name) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    run("wg-quick", &[if up { "up" } else { "down" }, name])?;
    info!("WireGuard {} {}", name, if up { "up" } else { "down" });
    Ok(())
}

pub fn import_config(name: &str, config: &str) -> Result<()> {
    if !valid_name(name) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    if !config.contains("[Interface]") {
        return Err(AgentError::InvalidRequest("not a valid WireGuard config".to_string()));
    }
    if config.len() > 16 * 1024 {
        return Err(AgentError::InvalidRequest("config too large".to_string()));
    }

    fs::create_dir_all(WG_DIR)
        .map_err(|e| AgentError::Internal(format!("failed to create {}: {}", WG_DIR, e)))?;
    let path = format!("{}/{}.conf", WG_DIR, name);
    let tmp = format!("{}.webdesk.tmp", path);
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| AgentError::Internal(format!("failed to create temp: {}", e)))?;
        f.write_all(config.as_bytes())
            .map_err(|e| AgentError::Internal(format!("failed to write temp: {}", e)))?;
        // Private keys live here — restrict to root.
        let _ = f.set_permissions(fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AgentError::Internal(format!("failed to write config: {}", e))
    })?;
    info!("WireGuard config '{}' imported", name);
    Ok(())
}

pub fn remove_config(name: &str) -> Result<()> {
    if !valid_name(name) {
        return Err(AgentError::InvalidRequest("invalid interface name".to_string()));
    }
    // Bring it down first (best-effort), then remove the config.
    let _ = run("wg-quick", &["down", name]);
    let path = format!("{}/{}.conf", WG_DIR, name);
    fs::remove_file(&path)
        .map_err(|e| AgentError::Internal(format!("failed to remove config: {}", e)))?;
    info!("WireGuard config '{}' removed", name);
    Ok(())
}
