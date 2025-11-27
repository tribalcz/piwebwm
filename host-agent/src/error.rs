use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Path not allowed: {0}")]
    PathNotAllowed(String),

    #[error("Path traversal attempt detected: {0}")]
    PathTraversal(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Operation timeout")]
    Timeout,

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, AgentError>;