package hostclient

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

type Request struct {
	ID     string `json:"id"`
	Action Action `json:"action"`
}

type Action struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// Response structures matching Rust protocol
type Response struct {
	ID     string      `json:"id"`
	Result interface{} `json:"result"` // ✅ Změna na interface{}
}

// Helper to parse result
func (r *Response) IsError() bool {
	resultMap, ok := r.Result.(map[string]interface{})
	if !ok {
		return false
	}
	_, hasError := resultMap["error"]
	return hasError
}

func (r *Response) GetError() string {
	resultMap, ok := r.Result.(map[string]interface{})
	if !ok {
		return ""
	}
	errMsg, _ := resultMap["error"].(string)
	return errMsg
}

func (r *Response) GetType() string {
	resultMap, ok := r.Result.(map[string]interface{})
	if !ok {
		return ""
	}
	typeStr, _ := resultMap["type"].(string)
	return typeStr
}

func (r *Response) GetData() map[string]interface{} {
	resultMap, ok := r.Result.(map[string]interface{})
	if !ok {
		return nil
	}
	data, _ := resultMap["data"].(map[string]interface{})
	return data
}

type ResponseResult struct {
	Type  string                 `json:"type,omitempty"`
	Data  map[string]interface{} `json:"data,omitempty"`
	Error string                 `json:"error,omitempty"`
	Code  int                    `json:"code,omitempty"`
}

type FileInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"is_dir"`
	Size        uint64 `json:"size"`
	Modified    int64  `json:"modified"`
	Permissions string `json:"permissions"`
}

type HostAgentClient struct {
	socketPath string
	mu         sync.Mutex
	requestID  int
}

func NewHostAgentClient(socketPath string) *HostAgentClient {
	return &HostAgentClient{
		socketPath: socketPath,
		requestID:  0,
	}
}

func (c *HostAgentClient) generateRequestID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requestID++
	return fmt.Sprintf("req-%d-%d", time.Now().Unix(), c.requestID)
}

func (c *HostAgentClient) sendRequest(action Action) (*Response, error) {
	// Connect to Unix socket
	conn, err := net.DialTimeout("unix", c.socketPath, 5*time.Second)
	if err != nil {
		return nil, errors.New("failed to connect to host agent: " + err.Error())
	}
	defer conn.Close()

	// Set timeout
	conn.SetDeadline(time.Now().Add(30 * time.Second))

	// Create request
	req := Request{
		ID:     c.generateRequestID(),
		Action: action,
	}

	// Send request
	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	log.Printf("[HostClient] Sending: %s", string(reqJSON))

	_, err = conn.Write(append(reqJSON, '\n'))
	if err != nil {
		return nil, err
	}

	// Read response
	reader := bufio.NewReader(conn)
	respLine, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	log.Printf("[HostClient] Received: %s", respLine)

	// Parse response
	var resp Response
	if err := json.Unmarshal([]byte(respLine), &resp); err != nil {
		return nil, err
	}

	// Check for error in response
	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}

	return &resp, nil
}

func (c *HostAgentClient) Ping() error {
	action := Action{
		Type: "Ping",
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return err
	}

	if resp.IsError() {
		return errors.New(resp.GetError())
	}

	if resp.GetType() != "Pong" {
		return errors.New("unexpected response to ping")
	}

	return nil
}

func (c *HostAgentClient) ListFiles(path string) ([]FileInfo, error) {
	action := Action{
		Type: "ListFiles",
		Params: map[string]interface{}{
			"path": path,
		},
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return nil, err
	}

	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}

	// Get data from response
	data := resp.GetData()
	if data == nil {
		return nil, errors.New("no data in response")
	}

	filesData, ok := data["files"]
	if !ok {
		return nil, errors.New("no files in response")
	}

	// Convert to JSON and back to parse properly
	filesJSON, err := json.Marshal(filesData)
	if err != nil {
		return nil, err
	}

	var files []FileInfo
	if err := json.Unmarshal(filesJSON, &files); err != nil {
		return nil, err
	}

	return files, nil
}

func (c *HostAgentClient) ReadFile(path string) (string, uint64, error) {
	action := Action{
		Type: "ReadFile",
		Params: map[string]interface{}{
			"path": path,
		},
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return "", 0, err
	}

	if resp.IsError() {
		return "", 0, errors.New(resp.GetError())
	}

	data := resp.GetData()
	if data == nil {
		return "", 0, errors.New("no data in response")
	}

	content, ok := data["content"].(string)
	if !ok {
		return "", 0, errors.New("invalid content in response")
	}

	size, ok := data["size"].(float64)
	if !ok {
		size = float64(len(content))
	}

	return content, uint64(size), nil
}

func (c *HostAgentClient) WriteFile(path string, content string) error {
	action := Action{
		Type: "WriteFile",
		Params: map[string]interface{}{
			"path":    path,
			"content": content,
		},
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return err
	}

	if resp.IsError() {
		return errors.New(resp.GetError())
	}

	return nil
}

func (c *HostAgentClient) CreateDir(path string) error {
	action := Action{
		Type: "CreateDir",
		Params: map[string]interface{}{
			"path": path,
		},
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return err
	}

	if resp.IsError() {
		return errors.New(resp.GetError())
	}

	return nil
}

func (c *HostAgentClient) DeleteFile(path string) error {
	action := Action{
		Type: "DeleteFile",
		Params: map[string]interface{}{
			"path": path,
		},
	}

	resp, err := c.sendRequest(action)
	if err != nil {
		return err
	}

	if resp.IsError() {
		return errors.New(resp.GetError())
	}

	return nil
}
