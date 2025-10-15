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