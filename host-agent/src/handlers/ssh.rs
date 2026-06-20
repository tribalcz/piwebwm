//! SSH daemon management: status, enable/disable, and hardening
//! (PasswordAuthentication, port) via managed sshd_config drop-ins.
//!
//! All values are validated before use and written atomically. The service is
//! addressed as `ssh` (the Debian/Raspberry Pi OS unit name).

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::SshStatus;
use log::info;
use std::fs;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;

const DROPIN_DIR: &str = "/etc/ssh/sshd_config.d";
const PORT_DROPIN: &str = "/etc/ssh/sshd_config.d/99-webdesk-port.conf";
const PWAUTH_DROPIN: &str = "/etc/ssh/sshd_config.d/99-webdesk-passwordauth.conf";

fn systemctl_is(prop: &str, unit: &str) -> bool {
    // `systemctl is-active`/`is-enabled` exit non-zero when false, so the helper
    // returns Err; treat any "active"/"enabled" stdout as true.
    run("systemctl", &[prop, unit])
        .map(|o| {
            let s = o.trim();
            s == "active" || s == "enabled"
        })
        .unwrap_or(false)
}

/// Reads the effective sshd config (`sshd -T`) into (port, password_auth).
fn effective_config() -> (u32, bool) {
    let out = run("sshd", &["-T"]).unwrap_or_default();
    let mut port = 22u32;
    let mut pwauth = true;
    for line in out.lines() {
        let mut it = line.split_whitespace();
        match it.next() {
            Some("port") => {
                if let Some(v) = it.next().and_then(|v| v.parse::<u32>().ok()) {
                    port = v;
                }
            }
            Some("passwordauthentication") => {
                pwauth = it.next() == Some("yes");
            }
            _ => {}
        }
    }
    (port, pwauth)
}

fn count_sessions(port: u32) -> u32 {
    run("ss", &["-Htn", "state", "established"])
        .map(|o| {
            o.lines()
                .filter(|l| {
                    l.split_whitespace()
                        .find(|f| f.contains(':'))
                        .map(|local| local.ends_with(&format!(":{}", port)))
                        .unwrap_or(false)
                })
                .count() as u32
        })
        .unwrap_or(0)
}

pub fn ssh_status() -> Result<SshStatus> {
    // If sshd isn't installed, `sshd -T` fails — report not installed.
    let installed = run("sshd", &["-V"]).is_ok()
        || std::path::Path::new("/usr/sbin/sshd").exists();
    let (port, password_auth) = effective_config();
    Ok(SshStatus {
        installed,
        active: systemctl_is("is-active", "ssh"),
        enabled: systemctl_is("is-enabled", "ssh"),
        port,
        password_auth,
        sessions: count_sessions(port),
    })
}

pub fn set_ssh_enabled(enabled: bool) -> Result<()> {
    if enabled {
        run("systemctl", &["enable", "--now", "ssh"])?;
    } else {
        run("systemctl", &["disable", "--now", "ssh"])?;
    }
    info!("SSH service {}", if enabled { "enabled" } else { "disabled" });
    Ok(())
}

/// Atomically writes a sshd drop-in file (0644, root-owned).
fn write_dropin(path: &str, contents: &str) -> Result<()> {
    fs::create_dir_all(DROPIN_DIR)
        .map_err(|e| AgentError::Internal(format!("failed to create {}: {}", DROPIN_DIR, e)))?;
    let tmp = format!("{}.webdesk.tmp", path);
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| AgentError::Internal(format!("failed to create temp: {}", e)))?;
        f.write_all(contents.as_bytes())
            .map_err(|e| AgentError::Internal(format!("failed to write temp: {}", e)))?;
        let _ = f.set_permissions(fs::Permissions::from_mode(0o644));
    }
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AgentError::Internal(format!("failed to write {}: {}", path, e))
    })
}

/// Validates the new sshd config before applying it, so a bad drop-in can't
/// leave sshd unable to start.
fn validate_sshd() -> Result<()> {
    run("sshd", &["-t"]).map(|_| ())
}

pub fn set_ssh_password_auth(enabled: bool) -> Result<()> {
    let body = format!(
        "# Managed by WebDesk OS\nPasswordAuthentication {}\n",
        if enabled { "yes" } else { "no" }
    );
    write_dropin(PWAUTH_DROPIN, &body)?;
    validate_sshd()?;
    run("systemctl", &["reload", "ssh"])?;
    info!("SSH PasswordAuthentication {}", enabled);
    Ok(())
}

pub fn set_ssh_port(port: u32) -> Result<()> {
    if port == 0 || port > 65535 {
        return Err(AgentError::InvalidRequest("invalid port (1–65535)".to_string()));
    }
    let body = format!("# Managed by WebDesk OS\nPort {}\n", port);
    write_dropin(PORT_DROPIN, &body)?;
    validate_sshd()?;
    // A port change needs a full restart, not reload.
    run("systemctl", &["restart", "ssh"])?;
    info!("SSH port set to {}", port);
    Ok(())
}
