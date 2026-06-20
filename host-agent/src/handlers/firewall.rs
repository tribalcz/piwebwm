//! Firewall management via ufw.
//!
//! Lockout protection is central here: enabling a default-deny firewall while
//! the WebDesk web port or SSH port is not allowed would cut off the very UI
//! used to manage it. Two safeguards:
//!   1. Guardrails — before enabling, the web port and the active SSH port are
//!      always allowed.
//!   2. Auto-revert — enabling arms a timer (see server.rs) that disables the
//!      firewall again unless the client confirms within the window.
//! Deletion of the protective web/SSH allow rules is refused outright.

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{FirewallRule, FirewallStatus};
use log::info;

/// Ports that must stay reachable so the operator never locks themselves out:
/// the backend's published port and the dev frontend port.
const GUARD_PORTS: [u32; 2] = [8090, 3000];

fn ufw(args: &[&str]) -> Result<String> {
    run("ufw", args)
}

fn installed() -> bool {
    std::path::Path::new("/usr/sbin/ufw").exists()
        || std::path::Path::new("/usr/bin/ufw").exists()
}

pub fn firewall_status() -> Result<FirewallStatus> {
    if !installed() {
        return Ok(FirewallStatus {
            installed: false,
            active: false,
            default_incoming: String::new(),
            default_outgoing: String::new(),
            rules: Vec::new(),
        });
    }

    let verbose = ufw(&["status", "verbose"]).unwrap_or_default();
    let active = verbose.lines().any(|l| l.trim_start().starts_with("Status:") && l.contains("active"));

    let (mut default_incoming, mut default_outgoing) = (String::new(), String::new());
    for line in verbose.lines() {
        if let Some(rest) = line.trim_start().strip_prefix("Default:") {
            // e.g. "deny (incoming), allow (outgoing), disabled (routed)"
            for part in rest.split(',') {
                let p = part.trim();
                if p.contains("(incoming)") {
                    default_incoming = p.split_whitespace().next().unwrap_or("").to_string();
                } else if p.contains("(outgoing)") {
                    default_outgoing = p.split_whitespace().next().unwrap_or("").to_string();
                }
            }
        }
    }

    // Numbered output gives a stable index for deletion.
    let numbered = ufw(&["status", "numbered"]).unwrap_or_default();
    let mut rules = Vec::new();
    for line in numbered.lines() {
        let line = line.trim();
        if !line.starts_with('[') {
            continue;
        }
        // "[ 1] 22/tcp                     ALLOW IN    Anywhere"
        let close = match line.find(']') {
            Some(i) => i,
            None => continue,
        };
        let number: u32 = line[1..close].trim().parse().unwrap_or(0);
        let rest = line[close + 1..].trim();
        // Split the body on 2+ spaces into columns.
        let cols: Vec<&str> = rest.split("  ").map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
        let to = cols.first().copied().unwrap_or("").to_string();
        let action = cols.get(1).copied().unwrap_or("").to_string();
        let from = cols.get(2).copied().unwrap_or("").to_string();
        rules.push(FirewallRule { number, to, action, from, raw: rest.to_string() });
    }

    Ok(FirewallStatus {
        installed: true,
        active,
        default_incoming,
        default_outgoing,
        rules,
    })
}

/// Enables/disables ufw. When enabling, the web and SSH ports are allowed first
/// (guardrail). Returns whether the firewall was previously inactive, so the
/// caller can arm an auto-revert that disables it again on timeout.
pub fn set_firewall_enabled(enabled: bool, ssh_port: u32) -> Result<bool> {
    if !installed() {
        return Err(AgentError::InvalidRequest("ufw is not installed".to_string()));
    }
    let was_active = firewall_status()?.active;

    if enabled {
        // Guardrail: never enable a default-deny firewall without keeping the
        // management paths open.
        for p in GUARD_PORTS.iter() {
            let _ = ufw(&["allow", &p.to_string()]);
        }
        if ssh_port > 0 && ssh_port <= 65535 {
            let _ = ufw(&["allow", &ssh_port.to_string()]);
        }
        ufw(&["--force", "enable"])?;
        info!("Firewall enabled (guardrails for web + SSH applied)");
    } else {
        ufw(&["disable"])?;
        info!("Firewall disabled");
    }
    Ok(!was_active && enabled)
}

/// Reverts an enable by disabling again (used by the auto-revert timer).
pub fn revert_enable() -> Result<()> {
    ufw(&["disable"])?;
    info!("Firewall auto-reverted (disabled)");
    Ok(())
}

fn valid_port(p: u32) -> bool {
    p >= 1 && p <= 65535
}

fn valid_proto(proto: &str) -> bool {
    matches!(proto, "tcp" | "udp" | "any")
}

/// A source spec: "any"/"Anywhere", or a bare IPv4/CIDR (light validation;
/// ufw does the authoritative parse).
fn valid_from(from: &str) -> bool {
    from.eq_ignore_ascii_case("any")
        || from.eq_ignore_ascii_case("anywhere")
        || from.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | '/' | ':'))
}

pub fn add_rule(action: &str, port: u32, proto: &str, from: &Option<String>) -> Result<()> {
    if !installed() {
        return Err(AgentError::InvalidRequest("ufw is not installed".to_string()));
    }
    if !matches!(action, "allow" | "deny" | "reject") {
        return Err(AgentError::InvalidRequest("invalid action".to_string()));
    }
    if !valid_port(port) {
        return Err(AgentError::InvalidRequest("invalid port (1–65535)".to_string()));
    }
    if !valid_proto(proto) {
        return Err(AgentError::InvalidRequest("invalid protocol".to_string()));
    }
    let from = from.as_deref().unwrap_or("any");
    if !valid_from(from) {
        return Err(AgentError::InvalidRequest("invalid source".to_string()));
    }

    let port_proto = if proto == "any" {
        port.to_string()
    } else {
        format!("{}/{}", port, proto)
    };

    if from.eq_ignore_ascii_case("any") || from.eq_ignore_ascii_case("anywhere") {
        ufw(&[action, &port_proto])?;
    } else {
        // ufw allow from <src> to any port <port> proto <proto>
        let port_s = port.to_string();
        if proto == "any" {
            ufw(&[action, "from", from, "to", "any", "port", &port_s])?;
        } else {
            ufw(&[action, "from", from, "to", "any", "port", &port_s, "proto", proto])?;
        }
    }
    info!("Firewall rule added: {} {} from {}", action, port_proto, from);
    Ok(())
}

/// Deletes a rule by its number, refusing to remove the protective web/SSH
/// allow rules (which would risk a lockout).
pub fn delete_rule(number: u32, ssh_port: u32) -> Result<()> {
    if !installed() {
        return Err(AgentError::InvalidRequest("ufw is not installed".to_string()));
    }
    let status = firewall_status()?;
    let rule = status.rules.iter().find(|r| r.number == number);
    if let Some(rule) = rule {
        let protected: Vec<String> = GUARD_PORTS
            .iter()
            .map(|p| p.to_string())
            .chain(std::iter::once(ssh_port.to_string()))
            .collect();
        let to = rule.to.split('/').next().unwrap_or(&rule.to);
        if rule.action.starts_with("ALLOW") && protected.iter().any(|p| p == to) {
            return Err(AgentError::InvalidRequest(format!(
                "refusing to delete the protective rule for port {} (would risk lockout)",
                to
            )));
        }
    }
    // ufw delete is interactive without --force.
    ufw(&["--force", "delete", &number.to_string()])?;
    info!("Firewall rule {} deleted", number);
    Ok(())
}
