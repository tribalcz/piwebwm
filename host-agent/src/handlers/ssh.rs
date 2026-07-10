//! SSH daemon management: status, enable/disable, and hardening
//! (PasswordAuthentication, port) via managed sshd_config drop-ins.
//!
//! All values are validated before use and written atomically. The service is
//! addressed as `ssh` (the Debian/Raspberry Pi OS unit name).

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{SshKey, SshSession, SshStatus};
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

/// Writes a drop-in and validates the resulting sshd config. If validation
/// fails, the drop-in is removed again so a later restart/reboot can't be
/// broken by a config that never took effect.
fn write_dropin_validated(path: &str, body: &str) -> Result<()> {
    write_dropin(path, body)?;
    if let Err(e) = validate_sshd() {
        let _ = fs::remove_file(path);
        return Err(e);
    }
    Ok(())
}

pub fn set_ssh_password_auth(enabled: bool) -> Result<()> {
    let body = format!(
        "# Managed by WebDesk OS\nPasswordAuthentication {}\n",
        if enabled { "yes" } else { "no" }
    );
    write_dropin_validated(PWAUTH_DROPIN, &body)?;
    run("systemctl", &["reload", "ssh"])?;
    info!("SSH PasswordAuthentication {}", enabled);
    Ok(())
}

pub fn set_ssh_port(port: u32) -> Result<()> {
    if port == 0 || port > 65535 {
        return Err(AgentError::InvalidRequest("invalid port (1–65535)".to_string()));
    }
    let body = format!("# Managed by WebDesk OS\nPort {}\n", port);
    write_dropin_validated(PORT_DROPIN, &body)?;
    // A port change needs a full restart, not reload.
    run("systemctl", &["restart", "ssh"])?;
    info!("SSH port set to {}", port);
    Ok(())
}

// --- Active sessions -------------------------------------------------------

/// Lists remote login sessions (those with a remote host in `who`), which on a
/// headless box are the SSH logins.
pub fn ssh_sessions() -> Result<Vec<SshSession>> {
    let out = run("who", &[]).unwrap_or_default();
    let mut sessions = Vec::new();
    for line in out.lines() {
        // e.g. "pi  pts/0  2026-06-16 14:30 (192.168.1.5)"
        let host = line
            .rfind('(')
            .and_then(|i| line[i + 1..].find(')').map(|j| line[i + 1..i + 1 + j].to_string()));
        let host = match host {
            Some(h) if !h.is_empty() && h != ":0" => h,
            _ => continue, // local console / no remote host
        };
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 4 {
            continue;
        }
        sessions.push(SshSession {
            user: f[0].to_string(),
            tty: f[1].to_string(),
            since: format!("{} {}", f[2], f[3]),
            from: host,
        });
    }
    Ok(sessions)
}

// --- Authorized keys -------------------------------------------------------

/// A safe Unix user name for use as a command argument / passwd lookup.
/// Must not start with '-' so it can never be read as a command flag (e.g. by
/// chown). It is additionally checked against /etc/passwd before use.
fn valid_user(user: &str) -> bool {
    !user.is_empty()
        && user.len() <= 32
        && !user.starts_with('-')
        && user.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

/// Regular login users (UID 1000–64999 with a real shell), from /etc/passwd.
///
/// root/system accounts (UID 0 and < 1000) are deliberately excluded: managing
/// root's authorized_keys from the web panel would let a single compromised
/// session install a persistent remote-root key. Administer root keys out of
/// band.
pub fn list_ssh_users() -> Result<Vec<String>> {
    let content = fs::read_to_string("/etc/passwd")
        .map_err(|e| AgentError::Internal(format!("failed to read /etc/passwd: {}", e)))?;
    let mut users = Vec::new();
    for line in content.lines() {
        let f: Vec<&str> = line.split(':').collect();
        if f.len() < 7 {
            continue;
        }
        let name = f[0];
        let uid: u32 = f[2].parse().unwrap_or(99999);
        let shell = f[6];
        let real_shell = !shell.ends_with("nologin") && !shell.ends_with("/false") && !shell.is_empty();
        if real_shell && uid >= 1000 && uid < 65000 {
            users.push(name.to_string());
        }
    }
    Ok(users)
}

/// Returns a validated user's home directory, ensuring the user is one we manage.
fn user_home(user: &str) -> Result<String> {
    if !valid_user(user) {
        return Err(AgentError::InvalidRequest("invalid user".to_string()));
    }
    if !list_ssh_users()?.iter().any(|u| u == user) {
        return Err(AgentError::InvalidRequest(format!("unknown user: {}", user)));
    }
    let content = fs::read_to_string("/etc/passwd")
        .map_err(|e| AgentError::Internal(format!("failed to read /etc/passwd: {}", e)))?;
    for line in content.lines() {
        let f: Vec<&str> = line.split(':').collect();
        if f.len() >= 7 && f[0] == user {
            return Ok(f[5].to_string());
        }
    }
    Err(AgentError::InvalidRequest(format!("no home for user: {}", user)))
}

fn authorized_keys_path(user: &str) -> Result<(String, String)> {
    let home = user_home(user)?;
    Ok((format!("{}/.ssh", home), format!("{}/.ssh/authorized_keys", home)))
}

pub fn list_ssh_keys(user: &str) -> Result<Vec<SshKey>> {
    let (_, akeys) = authorized_keys_path(user)?;
    let content = match fs::read_to_string(&akeys) {
        Ok(c) => c,
        Err(_) => return Ok(Vec::new()), // no keys yet
    };
    let mut keys = Vec::new();
    for (idx, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut it = line.split_whitespace();
        let kind = it.next().unwrap_or("").to_string();
        let body = it.next().unwrap_or("");
        let comment = it.collect::<Vec<_>>().join(" ");
        let preview = if body.len() > 12 { format!("…{}", &body[body.len() - 12..]) } else { body.to_string() };
        keys.push(SshKey { index: idx as u32, kind, comment, preview });
    }
    Ok(keys)
}

/// Validates a single-line OpenSSH public key (type + base64 body).
fn valid_pubkey(key: &str) -> bool {
    let key = key.trim();
    if key.is_empty() || key.len() > 16 * 1024 || key.contains('\n') {
        return false;
    }
    const TYPES: [&str; 8] = [
        "ssh-rsa", "ssh-ed25519", "ssh-dss",
        "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521",
        "sk-ssh-ed25519@openssh.com", "sk-ecdsa-sha2-nistp256@openssh.com",
    ];
    let mut it = key.split_whitespace();
    let kind = it.next().unwrap_or("");
    if !TYPES.contains(&kind) {
        return false;
    }
    let body = it.next().unwrap_or("");
    !body.is_empty() && body.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '='))
}

/// Ensures ~/.ssh exists with correct ownership/mode and rewrites
/// authorized_keys atomically, then fixes ownership/permissions.
fn write_authorized_keys(user: &str, dir: &str, path: &str, contents: &str) -> Result<()> {
    fs::create_dir_all(dir)
        .map_err(|e| AgentError::Internal(format!("failed to create {}: {}", dir, e)))?;
    fs::set_permissions(dir, fs::Permissions::from_mode(0o700)).ok();

    let tmp = format!("{}.webdesk.tmp", path);
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| AgentError::Internal(format!("failed to create temp: {}", e)))?;
        f.write_all(contents.as_bytes())
            .map_err(|e| AgentError::Internal(format!("failed to write temp: {}", e)))?;
        let _ = f.set_permissions(fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AgentError::Internal(format!("failed to write authorized_keys: {}", e))
    })?;

    // The agent runs as root; SSH requires the files to be owned by the user.
    let _ = run("chown", &["-R", user, dir]);
    Ok(())
}

pub fn add_ssh_key(user: &str, key: &str) -> Result<()> {
    if !valid_pubkey(key) {
        return Err(AgentError::InvalidRequest("invalid SSH public key".to_string()));
    }
    let (dir, path) = authorized_keys_path(user)?;
    let mut content = fs::read_to_string(&path).unwrap_or_default();
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(key.trim());
    content.push('\n');
    write_authorized_keys(user, &dir, &path, &content)?;
    info!("Added SSH key for {}", user);
    Ok(())
}

pub fn remove_ssh_key(user: &str, index: u32) -> Result<()> {
    let (dir, path) = authorized_keys_path(user)?;
    let content = fs::read_to_string(&path)
        .map_err(|e| AgentError::Internal(format!("failed to read authorized_keys: {}", e)))?;
    let kept: Vec<&str> = content
        .lines()
        .enumerate()
        .filter(|(i, _)| *i as u32 != index)
        .map(|(_, l)| l)
        .collect();
    let mut out = kept.join("\n");
    if !out.is_empty() {
        out.push('\n');
    }
    write_authorized_keys(user, &dir, &path, &out)?;
    info!("Removed SSH key {} for {}", index, user);
    Ok(())
}
