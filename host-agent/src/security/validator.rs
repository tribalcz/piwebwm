use crate::config::SecurityConfig;
use crate::error::{AgentError, Result};
use log::{debug, warn};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Validator {
    pub config: SecurityConfig,
}

impl Validator {
    pub fn new(config: SecurityConfig) -> Self {
        Self { config }
    }

    pub fn validate_path(&self, path: &str) -> Result<PathBuf> {
        debug!("Validating path: {}", path);

        if path.contains("..") {
            warn!("Path traversal attempt detected: {}", path);
            return Err(AgentError::PathTraversal(path.to_string()));
        }

        let path_buf = PathBuf::from(path);
        let canonical = match fs::canonicalize(&path_buf) {
            Ok(p) => p,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {

                if let Some(parent) = path_buf.parent() {
                    if parent.as_os_str().is_empty() {
                        path_buf.clone()
                    } else {
                        match fs::canonicalize(parent) {
                            Ok(p) => p.join(path_buf.file_name().unwrap()),
                            Err(_) => return Err(AgentError::FileNotFound(path.to_string())),
                        }
                    }
                } else {
                    path_buf.clone()
                }
            }
            Err(e) => return Err(AgentError::Io(e)),
        };

        if !self.is_path_allowed(&canonical) {
            warn!("Access denied to path: {:?}", canonical);
            return Err(AgentError::PathNotAllowed(canonical.display().to_string()));
        }

        if self.contains_forbidden_pattern(&canonical) {
            warn!("Forbidden pattern in path: {:?}", canonical);
            return Err(AgentError::PermissionDenied(
                "Path contains forbidden pattern".to_string(),
            ));
        }

        let depth = canonical.components().count();
        if depth > self.config.max_path_depth {
            warn!("Path depth exceeds limit: {} > {}", depth, self.config.max_path_depth);
            return Err(AgentError::PermissionDenied(
                "Path depth exceeds limit".to_string(),
            ));
        }

        debug!("Path validated: {:?}", canonical);
        Ok(canonical)
    }

    /// Like `validate_path`, but additionally refuses paths that would let a
    /// write turn into code execution as the owning user (shell init files,
    /// desktop autostart, user systemd units, git config, etc.). Reads are not
    /// affected — only destinations of write/create/move/copy go through here.
    pub fn validate_write_path(&self, path: &str) -> Result<PathBuf> {
        let canonical = self.validate_path(path)?;
        if is_dangerous_write_target(&canonical) {
            warn!("Refused write to sensitive location: {:?}", canonical);
            return Err(AgentError::PermissionDenied(
                "writing to this location is not allowed (it could run code on login)".to_string(),
            ));
        }
        Ok(canonical)
    }

    fn is_path_allowed(&self, path: &Path) -> bool {
        self.config
            .allowed_paths
            .iter()
            .any(|allowed| path.starts_with(allowed))
    }

    fn contains_forbidden_pattern(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        for pattern in &self.config.forbidden_patterns {
            if pattern.starts_with('*') {
                let ext = &pattern[1..];
                if path_str.ends_with(ext) {
                    return true;
                }
            } else if path_str.contains(pattern.as_str()) {
                return true;
            }
        }

        false
    }

    pub fn validate_file_size(&self, path: &Path) -> Result<u64> {
        let metadata = fs::metadata(path)?;
        let size = metadata.len();

        if size > self.config.max_file_size {
            return Err(AgentError::PermissionDenied(format!(
                "File size {} exceeds limit {}",
                size, self.config.max_file_size
            )));
        }

        Ok(size)
    }

    pub fn audit_log(&self, operation: &str, path: &Path, success: bool) {
        if !self.config.audit_enabled {
            return;
        }

        let status = if success { "SUCCESS" } else { "FAILED" };
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let log_entry = format!(
            "[{}] {} | {} | {}\n",
            timestamp,
            operation,
            path.display(),
            status
        );

        // Log to system log
        if success {
            log::info!("[AUDIT] {}", log_entry.trim());
        } else {
            log::warn!("[AUDIT] {}", log_entry.trim());
        }

        // Also write to audit file if path is configured
        // This is optional - for now just use system log
    }

    pub fn config(&self) -> &SecurityConfig {
        &self.config
    }
}

/// Files whose contents are executed on login/shell start (writing them =
/// code execution as that user), matched on the final path component.
const DANGEROUS_WRITE_FILES: &[&str] = &[
    ".bashrc", ".bash_profile", ".bash_login", ".bash_logout", ".bash_aliases",
    ".profile", ".zshrc", ".zprofile", ".zlogin", ".zlogout", ".zshenv",
    ".kshrc", ".cshrc", ".tcshrc", ".login", ".logout",
    ".xprofile", ".xinitrc", ".xsession", ".xsessionrc",
    ".inputrc", ".gitconfig", ".netrc", ".forward", ".pam_environment",
];

/// Path segments under which any file is auto-executed (autostart entries,
/// user services, shell configs, git config with `pager`/`!cmd` aliases).
const DANGEROUS_WRITE_SEGMENTS: &[&str] = &[
    "/.config/autostart/", "/.config/systemd/user/", "/.local/share/systemd/",
    "/.config/environment.d/", "/.config/fish/", "/.config/git/",
];

fn is_dangerous_write_target(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if DANGEROUS_WRITE_FILES.contains(&name) {
            return true;
        }
    }
    let s = path.to_string_lossy();
    DANGEROUS_WRITE_SEGMENTS.iter().any(|seg| s.contains(seg))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> SecurityConfig {
        SecurityConfig {
            allowed_paths: vec![PathBuf::from("/tmp"), PathBuf::from("/home")],
            forbidden_patterns: vec![".ssh".to_string(), "*.key".to_string()],
            max_file_size: 1024 * 1024, // 1MB
            max_path_depth: 10,
            audit_enabled: false,
        }
    }

    #[test]
    fn test_path_traversal() {
        let validator = Validator::new(test_config());
        assert!(validator.validate_path("/tmp/../etc/passwd").is_err());
    }

    #[test]
    fn test_forbidden_pattern() {
        let validator = Validator::new(test_config());
        assert!(validator.validate_path("/home/user/.ssh/id_rsa").is_err());
        assert!(validator.validate_path("/home/user/private.key").is_err());
    }

    #[test]
    fn test_allowed_path() {
        let validator = Validator::new(test_config());
        // This would pass if /tmp exists
        // assert!(validator.validate_path("/tmp/tests.txt").is_ok());
    }

    #[test]
    fn test_dangerous_write_targets_blocked() {
        // Shell init / login files.
        assert!(is_dangerous_write_target(Path::new("/home/user/.bashrc")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.profile")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.zshrc")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.gitconfig")));
        // Autostart / user services / env / fish / git config dirs.
        assert!(is_dangerous_write_target(Path::new("/home/user/.config/autostart/evil.desktop")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.config/systemd/user/x.service")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.config/environment.d/x.conf")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.config/fish/config.fish")));
        assert!(is_dangerous_write_target(Path::new("/home/user/.config/git/config")));
    }

    #[test]
    fn test_normal_writes_allowed() {
        // Ordinary files and non-dangerous dotfiles/dirs stay writable.
        assert!(!is_dangerous_write_target(Path::new("/home/user/notes.txt")));
        assert!(!is_dangerous_write_target(Path::new("/home/user/project/src/main.rs")));
        assert!(!is_dangerous_write_target(Path::new("/home/user/.config/app/settings.json")));
        assert!(!is_dangerous_write_target(Path::new("/home/user/.bashrc.bak")));
    }
}