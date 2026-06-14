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
