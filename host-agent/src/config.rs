use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub security: SecurityConfig,
    pub logging: LoggingConfig,
    pub performance: PerformanceConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ServerConfig {
    pub socket_path: String,
    pub socket_permissions: u32,
    pub socket_group: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SecurityConfig {
    pub allowed_paths: Vec<PathBuf>,
    pub forbidden_patterns: Vec<String>,
    pub max_file_size: u64,
    pub max_path_depth: usize,
    pub audit_enabled: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LoggingConfig {
    pub level: String,
    pub audit_path: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PerformanceConfig {
    pub max_concurrent_operations: usize,
    pub operation_timeout_secs: u64,
}

impl Config {
    pub fn load(path: &str) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: Config = serde_yaml::from_str(&content)?;
        Ok(config)
    }

    pub fn default() -> Self {
        Self {
            server: ServerConfig {
                socket_path: "/var/run/webdesk.sock".to_string(),
                socket_permissions: 0o660,
                socket_group: "webdesk".to_string(),
            },
            security: SecurityConfig {
                allowed_paths: vec![
                    PathBuf::from("/home"),
                    PathBuf::from("/media"),
                    PathBuf::from("/mnt"),
                ],
                forbidden_patterns: vec![
                    ".ssh".to_string(),
                    ".gnupg".to_string(),
                    "*.key".to_string(),
                ],
                max_file_size: 100 * 1024 * 1024, //100MB
                max_path_depth: 10,
                audit_enabled: true,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                audit_path: "/var/log/webdesk/audit.log".to_string(),
            },
            performance: PerformanceConfig {
                max_concurrent_operations: 10,
                operation_timeout_secs: 30,
            },
        }
    }
}