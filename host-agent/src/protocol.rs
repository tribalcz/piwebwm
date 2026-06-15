use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct Request {
    pub id: String,
    pub action: Action,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", content = "params")]
pub enum Action {
    // File operations
    ListFiles { path: String },
    ReadFile { path: String },
    WriteFile { path: String, content: String },
    CreateDir { path: String },
    DeleteFile { path: String },
    CopyFile { from: String, to: String },
    MoveFile { from: String, to: String },

    SystemInfo,
    ListProcesses,
    KillProcess { pid: u32 },

    // Network (reads + hostname write)
    NetworkStatus,
    NetworkInterfaces,
    RoutingTable,
    SetHostname { name: String },

    // Network configuration (NetworkManager) with optional auto-revert.
    SetInterfaceConfig {
        iface: String,
        method: String, // "auto" (DHCP) | "manual" (static)
        address: Option<String>,
        prefixlen: Option<u8>,
        gateway: Option<String>,
        dns: Option<Vec<String>>, // IPv4 and/or IPv6 servers, split by family
        dns_search: Option<Vec<String>>,
        // IPv6: when ipv6_method is None, IPv6 settings are left untouched.
        ipv6_method: Option<String>, // "auto" | "manual" | "disabled" | "ignore"
        ipv6_address: Option<String>,
        ipv6_prefixlen: Option<u8>,
        ipv6_gateway: Option<String>,
        revert_seconds: u64, // 0 = apply immediately, no revert
    },
    ConfirmNetworkConfig {
        token: String,
    },

    // Static route management (NetworkManager, persistent).
    AddRoute {
        iface: String,
        dst: String, // CIDR, e.g. 10.0.0.0/24
        gateway: Option<String>,
    },
    DeleteRoute {
        iface: String,
        dst: String,
        gateway: Option<String>,
    },

    // Interface link controls (runtime, via `ip link`).
    SetInterfaceState {
        iface: String,
        up: bool,
    },
    SetMtu {
        iface: String,
        mtu: u32,
    },

    // Wi-Fi management (NetworkManager).
    WifiScan {
        iface: String,
    },
    WifiConnect {
        iface: String,
        ssid: String,
        password: Option<String>,
    },
    WifiForget {
        ssid: String,
    },

    // Network diagnostics (bounded, fixed-arg external tools).
    Ping4 {
        host: String,
        count: u8,
    },
    Traceroute {
        host: String,
    },
    DnsLookup {
        host: String,
    },

    Ping,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Response {
    pub id: String,
    pub result: ResponseResult,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum ResponseResult {
    Success(ResponseData),
    Error { error: String, code: u32 },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ResponseData {
    Files { files: Vec<FileInfo> },
    FileContent { content: String, size: u64 },
    Success { message: String },
    SystemInfo(SystemInfo),
    Processes { processes: Vec<ProcessInfo> },
    NetworkStatusData(NetworkStatus),
    Interfaces { interfaces: Vec<NetworkInterface> },
    Routes { routes: Vec<RouteEntry> },
    NetworkApplied { token: Option<String>, revert_seconds: u64 },
    WifiNetworks { networks: Vec<WifiNetwork> },
    CommandOutput { output: String },
    Pong,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
    pub permissions: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SystemInfo {
    pub cpu: f64,
    pub memory: f64,
    pub disk: f64,
    pub uptime: u64,
    pub hostname: String,
    pub processes: usize,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
    pub status: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NetworkStatus {
    pub hostname: String,
    pub gateway: Option<String>,
    pub dns: Vec<String>,
    pub online: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NetworkAddress {
    pub family: String, // "ipv4" | "ipv6"
    pub address: String,
    pub prefixlen: u8,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub kind: String, // "ethernet" | "wifi" | "loopback" | "other"
    pub state: String, // "up" | "down" | "unknown"
    pub mac: Option<String>,
    pub addresses: Vec<NetworkAddress>,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub speed_mbps: Option<i64>,
    pub mtu: u32,
    pub rx_errors: u64,
    pub tx_errors: u64,
    pub rx_dropped: u64,
    pub tx_dropped: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal: u8,      // 0–100
    pub security: String, // "WPA2", "open", …
    pub in_use: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RouteEntry {
    pub dst: String,
    pub gateway: Option<String>,
    pub dev: String,
    pub protocol: Option<String>,
}