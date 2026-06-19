/**
 * Types for the Go backend REST API (/api/*)
 * Field names mirror the JSON emitted by backend/handlers.go
 * and the FileInfo struct in backend/host-client/client.go.
 */

export interface FileInfo {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified: number;
    permissions: string;
}

/** GET /api/files/list */
export interface ListFilesResponse {
    path: string;
    files: FileInfo[];
}

/** GET /api/files/read */
export interface ReadFileResponse {
    path: string;
    content: string;
    size: number;
}

/** POST /api/files/create, DELETE /api/files/delete */
export interface FileOperationResponse {
    success: boolean;
    path: string;
    message: string;
}

/** POST /api/files/move */
export interface MoveFileResponse {
    success: boolean;
    message: string;
}

/** GET /api/time */
export interface TimeResponse {
    time: string;
    date: string;
}

/** GET /health */
export interface HealthResponse {
    status: string;
    backend: string;
    host_mode: boolean;
    time: number;
}

/** Error payload returned by the API on 4xx/5xx */
export interface ApiErrorResponse {
    error: string;
}

/** GET /api/system/network/status */
export interface NetworkStatus {
    hostname: string;
    gateway: string | null;
    dns: string[];
    online: boolean;
}

export interface NetworkAddress {
    family: string; // "ipv4" | "ipv6"
    address: string;
    prefixlen: number;
}

export interface NetworkInterface {
    name: string;
    kind: string; // "ethernet" | "wifi" | "loopback" | "other"
    state: string; // "up" | "down" | "unknown"
    mac: string | null;
    addresses: NetworkAddress[];
    rx_bytes: number;
    tx_bytes: number;
    speed_mbps: number | null;
    mtu: number;
    rx_errors: number;
    tx_errors: number;
    rx_dropped: number;
    tx_dropped: number;
}

/** GET /api/system/network/interfaces */
export interface NetworkInterfacesResponse {
    interfaces: NetworkInterface[];
}

export interface RouteEntry {
    dst: string;
    gateway: string | null;
    dev: string;
    protocol: string | null;
}

/** GET /api/system/network/routes */
export interface RoutesResponse {
    routes: RouteEntry[];
}

export interface WifiNetwork {
    ssid: string;
    signal: number;   // 0–100
    security: string; // "WPA2", "open", …
    in_use: boolean;
}

/** GET /api/system/network/wifi/scan */
export interface WifiScanResponse {
    networks: WifiNetwork[];
}

/** POST /api/system/network/diagnostic */
export interface DiagnosticResponse {
    output: string;
}

/** GET /api/system/time */
export interface TimeSettings {
    timezone: string;
    ntp: boolean;
    ntp_synced: boolean;
    time: string;
}

/** GET /api/system/timezones */
export interface TimezonesResponse {
    timezones: string[];
}

/** GET /api/system/locale */
export interface LocaleSettings {
    lang: string;
    keymap: string;
}

/** GET /api/system/locales */
export interface LocalesResponse {
    locales: string[];
}

/** GET /api/system/overview */
export interface SystemOverview {
    device: string;
    os: string;
    kernel: string;
    arch: string;
    hostname: string;
    uptime_secs: number;
    cpu_temp_c: number | null;
    cpu_model: string;
    cpu_cores: number;
}

export interface DiskUsage {
    mount: string;
    total: number;
    used: number;
}

/** GET /api/system/resources */
export interface Resources {
    cpu_total: number;
    cpu_idle: number;
    load1: number;
    load5: number;
    load15: number;
    cpu_cores: number;
    mem_total: number;
    mem_used: number;
    swap_total: number;
    swap_used: number;
    disks: DiskUsage[];
}
