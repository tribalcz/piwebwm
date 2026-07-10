//! Dedicated, validated editor backend for `/etc/hosts`.
//!
//! This deliberately does NOT go through the generic file API (whose allowlist
//! is /home, /media, /mnt). The path is fixed here — there is no user-supplied
//! path, so there is no traversal surface and no need to widen the allowlist.
//! Writes are validated line-by-line, backed up to /etc/hosts.bak, and applied
//! atomically (temp file + rename) so a crash mid-write can't truncate the file.

use crate::error::{AgentError, Result};
use crate::handlers::network::{valid_ipv4, valid_ipv6};
use log::info;
use std::fs;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;

const HOSTS_PATH: &str = "/etc/hosts";
const BACKUP_PATH: &str = "/etc/hosts.bak";
const MAX_HOSTS_BYTES: usize = 64 * 1024;
const MAX_LINES: usize = 2000;

pub fn read_hosts() -> Result<(String, u64)> {
    let content = fs::read_to_string(HOSTS_PATH)
        .map_err(|e| AgentError::Internal(format!("failed to read {}: {}", HOSTS_PATH, e)))?;
    let size = content.len() as u64;
    Ok((content, size))
}

/// A single hostname token in a hosts entry: dot-separated labels, each 1–63
/// chars of alphanumerics, '-' or '_' (the latter seen in some local setups),
/// not starting/ending with '-'.
fn valid_hostname_token(h: &str) -> bool {
    !h.is_empty()
        && h.len() <= 253
        && h.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
}

/// Validates the whole file: every non-empty, non-comment line must be
/// `IP hostname [hostname...]` with a valid IPv4/IPv6 address. Rejects oversize
/// input. A malformed hosts file can break name resolution, so this is strict.
pub fn validate_hosts(content: &str) -> Result<()> {
    if content.len() > MAX_HOSTS_BYTES {
        return Err(AgentError::InvalidRequest("hosts file too large".to_string()));
    }
    if content.lines().count() > MAX_LINES {
        return Err(AgentError::InvalidRequest("hosts file has too many lines".to_string()));
    }

    for (idx, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        // Drop any trailing inline comment before parsing the entry.
        let line = line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }

        let mut parts = line.split_whitespace();
        let ip = parts.next().unwrap_or("");
        if !(valid_ipv4(ip) || valid_ipv6(ip)) {
            return Err(AgentError::InvalidRequest(format!(
                "line {}: invalid IP address '{}'",
                idx + 1,
                ip
            )));
        }

        let mut had_host = false;
        for host in parts {
            had_host = true;
            if !valid_hostname_token(host) {
                return Err(AgentError::InvalidRequest(format!(
                    "line {}: invalid hostname '{}'",
                    idx + 1,
                    host
                )));
            }
        }
        if !had_host {
            return Err(AgentError::InvalidRequest(format!(
                "line {}: entry has an IP but no hostname",
                idx + 1
            )));
        }
    }
    Ok(())
}

pub fn write_hosts(content: &str) -> Result<()> {
    validate_hosts(content)?;

    // Ensure a trailing newline (POSIX text file convention).
    let mut body = content.to_string();
    if !body.ends_with('\n') {
        body.push('\n');
    }

    // Back up the current file before replacing it.
    if let Ok(current) = fs::read(HOSTS_PATH) {
        fs::write(BACKUP_PATH, &current)
            .map_err(|e| AgentError::Internal(format!("failed to back up hosts file: {}", e)))?;
    }

    // Atomic replace: write a sibling temp file, then rename over the target.
    let tmp = format!("{}.webdesk.tmp", HOSTS_PATH);
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| AgentError::Internal(format!("failed to create temp file: {}", e)))?;
        f.write_all(body.as_bytes())
            .map_err(|e| AgentError::Internal(format!("failed to write temp file: {}", e)))?;
        f.flush()
            .map_err(|e| AgentError::Internal(format!("failed to flush temp file: {}", e)))?;
        // hosts is conventionally world-readable, root-writable.
        let _ = f.set_permissions(fs::Permissions::from_mode(0o644));
    }
    fs::rename(&tmp, HOSTS_PATH).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AgentError::Internal(format!("failed to replace hosts file: {}", e))
    })?;

    info!("Updated {} ({} bytes)", HOSTS_PATH, body.len());
    Ok(())
}
