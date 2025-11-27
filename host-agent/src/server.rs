use crate::config::Config;
use crate::error::{AgentError, Result};
use crate::handlers;
use crate::security::Validator;
use anyhow::Context;
use log::{debug, error, info, warn};
use serde_json;
use std::path::Path;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use crate::handlers::files::FileHandler;
use crate::protocol::{Action, Request, Response, ResponseData, ResponseResult};

pub async fn run(config: Config) -> anyhow::Result<()> {
    let socket_path = &config.server.socket_path;

    if Path::new(socket_path).exists() {
        std::fs::remove_file(socket_path)
            .context("Failed to remove old socket")?;
    }

    let listener = UnixListener::bind(socket_path)
        .context("Failed to bind Unix socket")?;

    info!("Host agent listening on {}", socket_path);

    // TODO: Set socket permissions

    let validator = Validator::new(config.security.clone());

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let config = config.clone();
                let validator = validator.clone();

                tokio::spawn(async move {
                    if let Err(e) = handle_client(stream, config, validator).await {
                        error!("Client error: {}", e);
                    }
                });
            }
            Err(e) => {
                error!("Accept error: {}", e);
            }
        }
    }
}

async fn handle_client(
    stream: UnixStream,
    config: Config,
    validator: Validator,
) -> Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    loop {
        line.clear();

        match reader.read_line(&mut line).await {
            Ok(0) => break,
            Ok(_) => {
                debug!("Received: {}", line.trim());

                let response_json = process_request(&line, &config, &validator).await;

                writer.write_all(response_json.as_bytes()).await?;
                writer.write_all(b"\n").await?;
                writer.flush().await?;
            }
            Err(e) => {
                error!("Read error: {}", e);
                break;
            }
        }
    }

    Ok(())
}

async fn process_request(
    request_str: &str,
    _config: &Config,
    validator: &Validator,
) -> String {
    // Parse request
    let request: Request = match serde_json::from_str(request_str) {
        Ok(r) => r,
        Err(e) => {
            let error_response = Response {
                id: "unknown".to_string(),
                result: ResponseResult::Error {
                    error: format!("Invalid request: {}", e),
                    code: 400,
                },
            };
            return serde_json::to_string(&error_response).unwrap();
        }
    };

    // Create handlers
    let file_handler = FileHandler::new(validator.clone());

    // Process action
    let result = match request.action {
        Action::Ping => ResponseResult::Success(ResponseData::Pong),

        Action::ListFiles { path } => match file_handler.list_files(&path) {
            Ok(files) => ResponseResult::Success(ResponseData::Files { files }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::ReadFile { path } => match file_handler.read_file(&path) {
            Ok((content, size)) => {
                ResponseResult::Success(ResponseData::FileContent { content, size })
            }
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::WriteFile { path, content } => match file_handler.write_file(&path, &content) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "File written successfully".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::CreateDir { path } => match file_handler.create_dir(&path) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Directory created successfully".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::DeleteFile { path } => match file_handler.delete(&path) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Deleted successfully".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::CopyFile { from, to } => match file_handler.copy(&from, &to) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Copied successfully".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::MoveFile { from, to } => match file_handler.move_item(&from, &to) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Moved successfully".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        _ => ResponseResult::Error {
            error: "Not implemented yet".to_string(),
            code: 501,
        },
    };

    // Create response
    let response = Response {
        id: request.id,
        result,
    };

    serde_json::to_string(&response).unwrap_or_else(|_| {
        r#"{"id":"error","result":{"error":"Serialization failed","code":500}}"#.to_string()
    })
}