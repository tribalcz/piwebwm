use crate::config::Config;
use crate::error::{AgentError, Result};
use crate::handlers;
use crate::security::Validator;
use anyhow::Context;
use log::{debug, error, info, warn};
use serde_json;
use std::collections::HashMap;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::time::sleep;
use crate::handlers::files::FileHandler;
use crate::handlers::network;
use crate::protocol::{Action, Request, Response, ResponseData, ResponseResult};

/// Pending auto-reverts, keyed by token. A change waits here until the client
/// confirms it (token removed → kept) or the timer fires (token taken → revert).
/// Shared across client connections so a confirm can arrive on a new connection.
type Reverts = Arc<Mutex<HashMap<String, network::PrevConfig>>>;

/// Pending firewall-enable auto-reverts, keyed by token. Presence means "still
/// awaiting confirmation"; the timer disables the firewall if the token is
/// still here when it fires.
type FwReverts = Arc<Mutex<HashMap<String, ()>>>;

pub async fn run(config: Config) -> anyhow::Result<()> {
    let socket_path = &config.server.socket_path;

    if Path::new(socket_path).exists() {
        std::fs::remove_file(socket_path)
            .context("Failed to remove old socket")?;
    }

    let listener = UnixListener::bind(socket_path)
        .context("Failed to bind Unix socket")?;

    // Restrict access to the control socket. This is the agent's only
    // privilege boundary: without it any local process could drive file
    // operations with the agent's rights. Apply the configured group first,
    // then the mode, so group-readable permissions take effect atomically.
    apply_socket_permissions(socket_path, &config)?;

    info!("Host agent listening on {}", socket_path);

    let validator = Validator::new(config.security.clone());
    let reverts: Reverts = Arc::new(Mutex::new(HashMap::new()));
    let fw_reverts: FwReverts = Arc::new(Mutex::new(HashMap::new()));

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let config = config.clone();
                let validator = validator.clone();
                let reverts = reverts.clone();
                let fw_reverts = fw_reverts.clone();

                tokio::spawn(async move {
                    if let Err(e) = handle_client(stream, config, validator, reverts, fw_reverts).await {
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

/// Sets the control socket's group and mode from configuration.
///
/// A missing group is logged and tolerated (the mode still restricts access to
/// owner+group), but failing to apply the mode is fatal — we must not serve on
/// a world-accessible socket.
fn apply_socket_permissions(socket_path: &str, config: &Config) -> anyhow::Result<()> {
    let path = Path::new(socket_path);

    if !config.server.socket_group.is_empty() {
        match nix::unistd::Group::from_name(&config.server.socket_group) {
            Ok(Some(group)) => {
                nix::unistd::chown(path, None, Some(group.gid))
                    .context("Failed to set socket group")?;
            }
            Ok(None) => warn!(
                "Socket group '{}' not found; leaving default group",
                config.server.socket_group
            ),
            Err(e) => warn!(
                "Failed to resolve socket group '{}': {}",
                config.server.socket_group, e
            ),
        }
    }

    let mode = config.server.socket_permissions;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))
        .context("Failed to set socket permissions")?;
    info!("Socket permissions set to {:o}", mode);

    Ok(())
}

async fn handle_client(
    stream: UnixStream,
    config: Config,
    validator: Validator,
    reverts: Reverts,
    fw_reverts: FwReverts,
) -> Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Bound a single request line so a client cannot exhaust memory by sending
    // bytes without a newline. The cap is derived from the configured file-size
    // limit (content travels inline as JSON, which inflates the byte count)
    // plus headroom for the rest of the envelope.
    let max_line_len: u64 = config
        .security
        .max_file_size
        .saturating_mul(2)
        .saturating_add(1 << 20);

    loop {
        let mut buf: Vec<u8> = Vec::new();
        let mut limited = (&mut reader).take(max_line_len);

        match limited.read_until(b'\n', &mut buf).await {
            Ok(0) => break, // EOF
            Ok(n) => {
                // No terminating newline means either a final unterminated line
                // or a line that hit the cap. If we read up to the cap, reject.
                if buf.last() != Some(&b'\n') {
                    if n as u64 >= max_line_len {
                        error!("Request line exceeded {} bytes; closing connection", max_line_len);
                        let resp = r#"{"id":"unknown","result":{"error":"Request too large","code":413}}"#;
                        let _ = writer.write_all(resp.as_bytes()).await;
                        let _ = writer.write_all(b"\n").await;
                        let _ = writer.flush().await;
                    }
                    break;
                }

                let line = String::from_utf8_lossy(&buf);
                debug!("Received request ({} bytes)", n);

                let response_json = process_request(&line, &config, &validator, &reverts, &fw_reverts).await;

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
    reverts: &Reverts,
    fw_reverts: &FwReverts,
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

        Action::NetworkStatus => match network::network_status() {
            Ok(status) => ResponseResult::Success(ResponseData::NetworkStatusData(status)),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::NetworkInterfaces => match network::network_interfaces() {
            Ok(interfaces) => ResponseResult::Success(ResponseData::Interfaces { interfaces }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::RoutingTable => match network::routing_table() {
            Ok(routes) => ResponseResult::Success(ResponseData::Routes { routes }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::SetHostname { name } => match network::set_hostname(&name) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Hostname updated".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::SetInterfaceConfig {
            iface,
            method,
            address,
            prefixlen,
            gateway,
            dns,
            dns_search,
            ipv6_method,
            ipv6_address,
            ipv6_prefixlen,
            ipv6_gateway,
            revert_seconds,
        } => {
            let cfg = network::InterfaceConfig {
                iface,
                method,
                address,
                prefixlen,
                gateway,
                dns,
                dns_search,
                ipv6_method,
                ipv6_address,
                ipv6_prefixlen,
                ipv6_gateway,
            };
            match network::apply_interface_config(&cfg) {
                Ok(prev) => {
                    if revert_seconds > 0 {
                        let token = network::gen_token();
                        reverts.lock().unwrap().insert(token.clone(), prev);

                        // Auto-revert unless confirmed within the window.
                        let reverts2 = reverts.clone();
                        let token2 = token.clone();
                        tokio::spawn(async move {
                            sleep(Duration::from_secs(revert_seconds)).await;
                            let entry = reverts2.lock().unwrap().remove(&token2);
                            if let Some(prev) = entry {
                                warn!("Auto-reverting network change {} after {}s", token2, revert_seconds);
                                if let Err(e) = network::restore_interface_config(&prev) {
                                    error!("Auto-revert failed: {}", e);
                                }
                            }
                        });

                        ResponseResult::Success(ResponseData::NetworkApplied {
                            token: Some(token),
                            revert_seconds,
                        })
                    } else {
                        ResponseResult::Success(ResponseData::NetworkApplied {
                            token: None,
                            revert_seconds: 0,
                        })
                    }
                }
                Err(e) => ResponseResult::Error {
                    error: e.to_string(),
                    code: 400,
                },
            }
        }

        Action::ConfirmNetworkConfig { token } => {
            let kept = reverts.lock().unwrap().remove(&token).is_some();
            ResponseResult::Success(ResponseData::Success {
                message: if kept {
                    "Network change kept".to_string()
                } else {
                    "No pending change for token".to_string()
                },
            })
        }

        Action::AddRoute { iface, dst, gateway } => match network::add_route(&iface, &dst, &gateway) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Route added".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::DeleteRoute { iface, dst, gateway } => match network::delete_route(&iface, &dst, &gateway) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Route deleted".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::SetInterfaceState { iface, up } => match network::set_interface_state(&iface, up) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: format!("Interface {}", if up { "enabled" } else { "disabled" }),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::SetMtu { iface, mtu } => match network::set_mtu(&iface, mtu) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "MTU updated".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::DhcpLease { iface } => match network::dhcp_lease(&iface) {
            Ok(output) => ResponseResult::Success(ResponseData::CommandOutput { output }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::WifiScan { iface } => match network::wifi_scan(&iface) {
            Ok(networks) => ResponseResult::Success(ResponseData::WifiNetworks { networks }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::WifiConnect { iface, ssid, password } => {
            match network::wifi_connect(&iface, &ssid, &password) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: "Wi-Fi connected".to_string(),
                }),
                Err(e) => ResponseResult::Error {
                    error: e.to_string(),
                    code: 400,
                },
            }
        }

        Action::WifiForget { ssid } => match network::wifi_forget(&ssid) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "Wi-Fi network forgotten".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::Ping4 { host, count } => match network::ping4(&host, count) {
            Ok(output) => ResponseResult::Success(ResponseData::CommandOutput { output }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::Traceroute { host } => match network::traceroute(&host) {
            Ok(output) => ResponseResult::Success(ResponseData::CommandOutput { output }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::DnsLookup { host } => match network::dns_lookup(&host) {
            Ok(output) => ResponseResult::Success(ResponseData::CommandOutput { output }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::ReadHosts => match handlers::hosts::read_hosts() {
            Ok((content, size)) => {
                ResponseResult::Success(ResponseData::FileContent { content, size })
            }
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 500,
            },
        },

        Action::WriteHosts { content } => match handlers::hosts::write_hosts(&content) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "hosts file updated".to_string(),
            }),
            Err(e) => ResponseResult::Error {
                error: e.to_string(),
                code: 400,
            },
        },

        Action::GetTimeSettings => match handlers::datetime::get_time_settings() {
            Ok(s) => ResponseResult::Success(ResponseData::TimeSettingsData(s)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::ListTimezones => match handlers::datetime::list_timezones() {
            Ok(items) => ResponseResult::Success(ResponseData::StringList { items }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::SetTimezone { tz } => match handlers::datetime::set_timezone(&tz) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "timezone updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::SetNtp { enabled } => match handlers::datetime::set_ntp(enabled) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "NTP updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::SetTime { time } => match handlers::datetime::set_time(&time) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "time updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::GetLocale => match handlers::datetime::get_locale() {
            Ok(s) => ResponseResult::Success(ResponseData::LocaleSettingsData(s)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::ListLocales => match handlers::datetime::list_locales() {
            Ok(items) => ResponseResult::Success(ResponseData::StringList { items }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::SetLocale { lang } => match handlers::datetime::set_locale(&lang) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "locale updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::GetSystemOverview => match handlers::sysinfo::get_system_overview() {
            Ok(o) => ResponseResult::Success(ResponseData::SystemOverviewData(o)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::GetResources => match handlers::sysinfo::get_resources() {
            Ok(r) => ResponseResult::Success(ResponseData::ResourcesData(r)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        // --- SSH ---------------------------------------------------------
        Action::SshStatus => match handlers::ssh::ssh_status() {
            Ok(s) => ResponseResult::Success(ResponseData::SshStatusData(s)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::SetSshEnabled { enabled } => match handlers::ssh::set_ssh_enabled(enabled) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: format!("SSH {}", if enabled { "enabled" } else { "disabled" }),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::SetSshPasswordAuth { enabled } => match handlers::ssh::set_ssh_password_auth(enabled) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "SSH password authentication updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::SetSshPort { port } => match handlers::ssh::set_ssh_port(port) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "SSH port updated".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::SshSessions => match handlers::ssh::ssh_sessions() {
            Ok(sessions) => ResponseResult::Success(ResponseData::SshSessionsData { sessions }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::ListSshUsers => match handlers::ssh::list_ssh_users() {
            Ok(items) => ResponseResult::Success(ResponseData::StringList { items }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::ListSshKeys { user } => match handlers::ssh::list_ssh_keys(&user) {
            Ok(keys) => ResponseResult::Success(ResponseData::SshKeysData { keys }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::AddSshKey { user, key } => match handlers::ssh::add_ssh_key(&user, &key) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "SSH key added".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        Action::RemoveSshKey { user, index } => match handlers::ssh::remove_ssh_key(&user, index) {
            Ok(_) => ResponseResult::Success(ResponseData::Success {
                message: "SSH key removed".to_string(),
            }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
        },

        // --- Firewall ----------------------------------------------------
        Action::FirewallStatus => match handlers::firewall::firewall_status() {
            Ok(s) => ResponseResult::Success(ResponseData::FirewallStatusData(s)),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::SetFirewallEnabled { enabled, revert_seconds } => {
            // The active SSH port is a guardrail input (kept open on enable).
            let ssh_port = handlers::ssh::ssh_status().map(|s| s.port).unwrap_or(22);
            match handlers::firewall::set_firewall_enabled(enabled, ssh_port) {
                Ok(newly_enabled) => {
                    if newly_enabled && revert_seconds > 0 {
                        let token = network::gen_token();
                        fw_reverts.lock().unwrap().insert(token.clone(), ());
                        let fw2 = fw_reverts.clone();
                        let token2 = token.clone();
                        tokio::spawn(async move {
                            sleep(Duration::from_secs(revert_seconds)).await;
                            let pending = fw2.lock().unwrap().remove(&token2).is_some();
                            if pending {
                                warn!("Auto-reverting firewall enable {} after {}s", token2, revert_seconds);
                                if let Err(e) = handlers::firewall::revert_enable() {
                                    error!("Firewall auto-revert failed: {}", e);
                                }
                            }
                        });
                        ResponseResult::Success(ResponseData::FirewallApplied {
                            token: Some(token),
                            revert_seconds,
                        })
                    } else {
                        ResponseResult::Success(ResponseData::FirewallApplied {
                            token: None,
                            revert_seconds: 0,
                        })
                    }
                }
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

        Action::ConfirmFirewall { token } => {
            let kept = fw_reverts.lock().unwrap().remove(&token).is_some();
            ResponseResult::Success(ResponseData::Success {
                message: if kept {
                    "Firewall change kept".to_string()
                } else {
                    "No pending firewall change for token".to_string()
                },
            })
        }

        Action::AddFirewallRule { action, port, proto, from } => {
            match handlers::firewall::add_rule(&action, port, &proto, &from) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: "Firewall rule added".to_string(),
                }),
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

        Action::DeleteFirewallRule { number } => {
            let ssh_port = handlers::ssh::ssh_status().map(|s| s.port).unwrap_or(22);
            match handlers::firewall::delete_rule(number, ssh_port) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: "Firewall rule deleted".to_string(),
                }),
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

        // --- WireGuard ---------------------------------------------------
        Action::WireguardStatus => match handlers::wireguard::wireguard_status() {
            Ok(interfaces) => ResponseResult::Success(ResponseData::WireguardData { interfaces }),
            Err(e) => ResponseResult::Error { error: e.to_string(), code: 500 },
        },

        Action::SetWireguardInterface { iface, up } => {
            match handlers::wireguard::set_interface(&iface, up) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: format!("WireGuard {} {}", iface, if up { "up" } else { "down" }),
                }),
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

        Action::ImportWireguardConfig { name, config } => {
            match handlers::wireguard::import_config(&name, &config) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: "WireGuard config imported".to_string(),
                }),
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

        Action::RemoveWireguardConfig { name } => {
            match handlers::wireguard::remove_config(&name) {
                Ok(_) => ResponseResult::Success(ResponseData::Success {
                    message: "WireGuard config removed".to_string(),
                }),
                Err(e) => ResponseResult::Error { error: e.to_string(), code: 400 },
            }
        }

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