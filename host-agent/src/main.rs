mod config;
mod error;
mod server;
mod handlers;
mod security;
mod protocol;

use anyhow::Result;
use log::{info, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logger
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    ).init();

    info!("WebDesk Host Agent starting...");

    // Load configuration
    let config = match config::Config::load("config.yaml") {
        Ok(cfg) => {
            info!("Configuration loaded from config.yaml");
            cfg
        }
        Err(e) => {
            error!("Failed to load config.yaml: {}, using defaults", e);
            config::Config::default()
        }
    };

    // Start server
    info!("Starting Unix socket server on {}", config.server.socket_path);

    if let Err(e) = server::run(config).await {
        error!("Server error: {}", e);
        std::process::exit(1);
    }

    Ok(())
}