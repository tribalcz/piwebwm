use crate::error::{AgentError, Result};
use crate::protocol::FileInfo;
use crate::security::Validator;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::SystemTime;


pub struct FileHandler {
    validator: Validator,
}

impl FileHandler {
    pub fn new(validator: Validator) -> Self {
        Self { validator }
    }

    pub fn list_files(&self, path: &str) -> Result<Vec<FileInfo>> {
        info!("Listing files: {}", path);

        let validated_path = self.validator.validate_path(path)?;

        let metadata = fs::metadata(&validated_path)?;
        if !metadata.is_dir() {
            return Err(AgentError::InvalidRequest(
                "Path is not a directory".to_string(),
            ));
        }

        let entries = fs::read_dir(&validated_path)?;
        let mut files = Vec::new();

        for entry in entries {
            match entry {
                Ok(entry) => {
                    let entry_path = entry.path();

                    let metadata = match entry.metadata() {
                        Ok(m) => m,
                        Err(e) => {
                            debug!("Failed to read metadata for {:?}: {}", entry_path, e);
                            continue;
                        }
                    };

                    let modified = metadata
                        .modified()
                        .unwrap_or(SystemTime::UNIX_EPOCH)
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    let permissions = format!("{:o}", metadata.permissions().mode() & 0o777);

                    files.push(FileInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: entry_path.to_string_lossy().to_string(),
                        is_dir: metadata.is_dir(),
                        size: if metadata.is_dir() { 0 } else { metadata.len() },
                        modified,
                        permissions,
                    });
                }
                Err(e) => {
                    debug!("Error reading directory entry: {}", e);
                    continue;
                }
            }
        }

        files.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            } else if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        });

        self.validator.audit_log("LIST", &validated_path, true);
        Ok(files)
    }

    pub fn read_file(&self, path: &str) -> Result<(String, u64)> {
        info!("Reading file: {}", path);

        let validated_path = self.validator.validate_path(path)?;

        let size = self.validator.validate_file_size(&validated_path)?;

        let content = fs::read_to_string(&validated_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::InvalidData {
                AgentError::InvalidRequest("File is not valid UTF-8 text".to_string())
            } else {
                AgentError::Io(e)
            }
        })?;

        self.validator.audit_log("READ", &validated_path, true);
        Ok((content, size))
    }

    pub fn write_file(&self, path: &str, content: &str) -> Result<()> {
        info!("Writing file: {}", path);

        let validated_path = self.validator.validate_path(path)?;

        if content.len() as u64 > self.validator.config.max_file_size {
            return Err(AgentError::PermissionDenied(
                "Content size exceeds limit".to_string(),
            ));
        }

        fs::write(&validated_path, content)?;

        self.validator.audit_log("WRITE", &validated_path, true);
        Ok(())
    }

    pub fn create_dir(&self, path: &str) -> Result<()> {
        info!("Creating directory: {}", path);

        let validated_path = self.validator.validate_path(path)?;

        fs::create_dir_all(&validated_path)?;

        self.validator.audit_log("CREATE_DIR", &validated_path, true);
        Ok(())
    }

    pub fn delete(&self, path: &str) -> Result<()> {
        info!("Deleting: {}", path);

        let validated_path = self.validator.validate_path(path)?;

        if !validated_path.exists() {
            return Err(AgentError::FileNotFound(path.to_string()));
        }

        if validated_path.is_dir() {
            fs::remove_dir_all(&validated_path)?;
        } else {
            fs::remove_file(&validated_path)?;
        }

        self.validator.audit_log("DELETE", &validated_path, true);
        Ok(())
    }

    pub fn copy(&self, from: &str, to: &str) -> Result<()> {
        info!("Copying from {} to {}", from, to);

        let from_path = self.validator.validate_path(from)?;
        let to_path = self.validator.validate_path(to)?;

        if !from_path.exists() {
            return Err(AgentError::FileNotFound(from.to_string()));
        }

        if from_path.is_dir() {
            self.copy_dir_recursive(&from_path, &to_path)?;
        } else {
            fs::copy(&from_path, &to_path)?;
        }

        self.validator.audit_log("COPY", &from_path, true);
        Ok(())
    }

    pub fn move_item(&self, from: &str, to: &str) -> Result<()> {
        info!("Moving from {} to {}", from, to);

        let from_path = self.validator.validate_path(from)?;
        let to_path = self.validator.validate_path(to)?;

        if !from_path.exists() {
            return Err(AgentError::FileNotFound(from.to_string()));
        }

        fs::rename(&from_path, &to_path)?;

        self.validator.audit_log("MOVE", &from_path, true);
        Ok(())
    }

    fn copy_dir_recursive(&self, from: &Path, to: &Path) -> Result<()> {
        fs::create_dir_all(to)?;

        for entry in fs::read_dir(from)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let from_path = entry.path();
            let to_path = to.join(entry.file_name());

            if file_type.is_dir() {
                self.copy_dir_recursive(&from_path, &to_path)?;
            } else {
                fs::copy(&from_path, &to_path)?;
            }
        }

        Ok(())
    }
}