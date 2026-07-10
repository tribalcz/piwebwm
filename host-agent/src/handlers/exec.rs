use crate::error::{AgentError, Result};
use std::process::Command;

/// Runs a fixed command with a fixed argument vector (no shell → no injection).
///
/// This is the single choke point for shelling out: every privileged helper
/// (iproute2, nmcli, timedatectl, localectl, …) goes through here with an
/// explicit argv, so user-supplied values are never interpreted by a shell.
pub fn run(cmd: &str, args: &[&str]) -> Result<String> {
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
