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

	log.Printf("[HostClient] Sending action: %s", action.Type)

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

	log.Printf("[HostClient] Received %d bytes for action %s", len(respLine), action.Type)

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

func (c *HostAgentClient) MoveFile(from string, to string) error {
	action := Action{
		Type: "MoveFile",
		Params: map[string]interface{}{
			"from": from,
			"to":   to,
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

// --- Network ---------------------------------------------------------------

type NetworkStatus struct {
	Hostname string   `json:"hostname"`
	Gateway  *string  `json:"gateway"`
	DNS      []string `json:"dns"`
	Online   bool     `json:"online"`
}

type NetworkAddress struct {
	Family    string `json:"family"`
	Address   string `json:"address"`
	Prefixlen int    `json:"prefixlen"`
}

type NetworkInterface struct {
	Name      string           `json:"name"`
	Kind      string           `json:"kind"`
	State     string           `json:"state"`
	MAC       *string          `json:"mac"`
	Addresses []NetworkAddress `json:"addresses"`
	RxBytes   uint64           `json:"rx_bytes"`
	TxBytes   uint64           `json:"tx_bytes"`
	SpeedMbps *int64           `json:"speed_mbps"`
	MTU       uint32           `json:"mtu"`
	RxErrors  uint64           `json:"rx_errors"`
	TxErrors  uint64           `json:"tx_errors"`
	RxDropped uint64           `json:"rx_dropped"`
	TxDropped uint64           `json:"tx_dropped"`
}

type WifiNetwork struct {
	SSID     string `json:"ssid"`
	Signal   uint8  `json:"signal"`
	Security string `json:"security"`
	InUse    bool   `json:"in_use"`
}

type RouteEntry struct {
	Dst      string  `json:"dst"`
	Gateway  *string `json:"gateway"`
	Dev      string  `json:"dev"`
	Protocol *string `json:"protocol"`
}

func (c *HostAgentClient) NetworkStatus() (*NetworkStatus, error) {
	resp, err := c.sendRequest(Action{Type: "NetworkStatus"})
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}

	data := resp.GetData()
	if data == nil {
		return nil, errors.New("no data in response")
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	var status NetworkStatus
	if err := json.Unmarshal(raw, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

func (c *HostAgentClient) NetworkInterfaces() ([]NetworkInterface, error) {
	resp, err := c.sendRequest(Action{Type: "NetworkInterfaces"})
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}

	data := resp.GetData()
	if data == nil {
		return nil, errors.New("no data in response")
	}
	raw, err := json.Marshal(data["interfaces"])
	if err != nil {
		return nil, err
	}
	var interfaces []NetworkInterface
	if err := json.Unmarshal(raw, &interfaces); err != nil {
		return nil, err
	}
	return interfaces, nil
}

func (c *HostAgentClient) RoutingTable() ([]RouteEntry, error) {
	resp, err := c.sendRequest(Action{Type: "RoutingTable"})
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}

	data := resp.GetData()
	if data == nil {
		return nil, errors.New("no data in response")
	}
	raw, err := json.Marshal(data["routes"])
	if err != nil {
		return nil, err
	}
	var routes []RouteEntry
	if err := json.Unmarshal(raw, &routes); err != nil {
		return nil, err
	}
	return routes, nil
}

func (c *HostAgentClient) SetHostname(name string) error {
	resp, err := c.sendRequest(Action{
		Type:   "SetHostname",
		Params: map[string]interface{}{"name": name},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

// --- Network configuration (phase 2) ---------------------------------------

type InterfaceConfigRequest struct {
	Iface         string
	Method        string
	Address       *string
	Prefixlen     *int
	Gateway       *string
	DNS           []string
	DNSSearch     []string
	IPv6Method    *string
	IPv6Address   *string
	IPv6Prefixlen *int
	IPv6Gateway   *string
	RevertSeconds uint64
}

// SetInterfaceConfig applies an interface config. Returns a revert token (when
// revert_seconds > 0) the caller must confirm before the agent reverts.
func (c *HostAgentClient) SetInterfaceConfig(req InterfaceConfigRequest) (*string, uint64, error) {
	params := map[string]interface{}{
		"iface":          req.Iface,
		"method":         req.Method,
		"revert_seconds": req.RevertSeconds,
	}
	if req.Address != nil {
		params["address"] = *req.Address
	}
	if req.Prefixlen != nil {
		params["prefixlen"] = *req.Prefixlen
	}
	if req.Gateway != nil {
		params["gateway"] = *req.Gateway
	}
	if req.DNS != nil {
		params["dns"] = req.DNS
	}
	if req.DNSSearch != nil {
		params["dns_search"] = req.DNSSearch
	}
	if req.IPv6Method != nil {
		params["ipv6_method"] = *req.IPv6Method
	}
	if req.IPv6Address != nil {
		params["ipv6_address"] = *req.IPv6Address
	}
	if req.IPv6Prefixlen != nil {
		params["ipv6_prefixlen"] = *req.IPv6Prefixlen
	}
	if req.IPv6Gateway != nil {
		params["ipv6_gateway"] = *req.IPv6Gateway
	}

	resp, err := c.sendRequest(Action{Type: "SetInterfaceConfig", Params: params})
	if err != nil {
		return nil, 0, err
	}
	if resp.IsError() {
		return nil, 0, errors.New(resp.GetError())
	}

	data := resp.GetData()
	var token *string
	if data != nil {
		if t, ok := data["token"].(string); ok {
			token = &t
		}
	}
	var secs uint64
	if data != nil {
		if s, ok := data["revert_seconds"].(float64); ok {
			secs = uint64(s)
		}
	}
	return token, secs, nil
}

func (c *HostAgentClient) ConfirmNetworkConfig(token string) error {
	resp, err := c.sendRequest(Action{
		Type:   "ConfirmNetworkConfig",
		Params: map[string]interface{}{"token": token},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

func (c *HostAgentClient) AddRoute(iface, dst string, gateway *string) error {
	params := map[string]interface{}{"iface": iface, "dst": dst}
	if gateway != nil {
		params["gateway"] = *gateway
	}
	resp, err := c.sendRequest(Action{Type: "AddRoute", Params: params})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

func (c *HostAgentClient) DeleteRoute(iface, dst string, gateway *string) error {
	params := map[string]interface{}{"iface": iface, "dst": dst}
	if gateway != nil {
		params["gateway"] = *gateway
	}
	resp, err := c.sendRequest(Action{Type: "DeleteRoute", Params: params})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

// --- Interface link controls -----------------------------------------------

func (c *HostAgentClient) SetInterfaceState(iface string, up bool) error {
	resp, err := c.sendRequest(Action{
		Type:   "SetInterfaceState",
		Params: map[string]interface{}{"iface": iface, "up": up},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

func (c *HostAgentClient) SetMtu(iface string, mtu uint32) error {
	resp, err := c.sendRequest(Action{
		Type:   "SetMtu",
		Params: map[string]interface{}{"iface": iface, "mtu": mtu},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

func (c *HostAgentClient) DhcpLease(iface string) (string, error) {
	return c.runDiag(Action{
		Type:   "DhcpLease",
		Params: map[string]interface{}{"iface": iface},
	})
}

// --- Wi-Fi -----------------------------------------------------------------

func (c *HostAgentClient) WifiScan(iface string) ([]WifiNetwork, error) {
	resp, err := c.sendRequest(Action{
		Type:   "WifiScan",
		Params: map[string]interface{}{"iface": iface},
	})
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errors.New(resp.GetError())
	}
	data := resp.GetData()
	if data == nil {
		return nil, errors.New("no data in response")
	}
	raw, err := json.Marshal(data["networks"])
	if err != nil {
		return nil, err
	}
	var nets []WifiNetwork
	if err := json.Unmarshal(raw, &nets); err != nil {
		return nil, err
	}
	return nets, nil
}

func (c *HostAgentClient) WifiConnect(iface, ssid string, password *string) error {
	params := map[string]interface{}{"iface": iface, "ssid": ssid}
	if password != nil {
		params["password"] = *password
	}
	resp, err := c.sendRequest(Action{Type: "WifiConnect", Params: params})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

func (c *HostAgentClient) WifiForget(ssid string) error {
	resp, err := c.sendRequest(Action{
		Type:   "WifiForget",
		Params: map[string]interface{}{"ssid": ssid},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}

// --- Diagnostics -----------------------------------------------------------

// runDiag dispatches a diagnostic action that returns CommandOutput.
func (c *HostAgentClient) runDiag(action Action) (string, error) {
	resp, err := c.sendRequest(action)
	if err != nil {
		return "", err
	}
	if resp.IsError() {
		return "", errors.New(resp.GetError())
	}
	data := resp.GetData()
	if data == nil {
		return "", errors.New("no data in response")
	}
	out, _ := data["output"].(string)
	return out, nil
}

func (c *HostAgentClient) Ping4(host string, count uint8) (string, error) {
	return c.runDiag(Action{
		Type:   "Ping4",
		Params: map[string]interface{}{"host": host, "count": count},
	})
}

func (c *HostAgentClient) Traceroute(host string) (string, error) {
	return c.runDiag(Action{
		Type:   "Traceroute",
		Params: map[string]interface{}{"host": host},
	})
}

func (c *HostAgentClient) DnsLookup(host string) (string, error) {
	return c.runDiag(Action{
		Type:   "DnsLookup",
		Params: map[string]interface{}{"host": host},
	})
}

// --- /etc/hosts editor -----------------------------------------------------

func (c *HostAgentClient) ReadHosts() (string, error) {
	resp, err := c.sendRequest(Action{Type: "ReadHosts"})
	if err != nil {
		return "", err
	}
	if resp.IsError() {
		return "", errors.New(resp.GetError())
	}
	data := resp.GetData()
	if data == nil {
		return "", errors.New("no data in response")
	}
	content, _ := data["content"].(string)
	return content, nil
}

func (c *HostAgentClient) WriteHosts(content string) error {
	resp, err := c.sendRequest(Action{
		Type:   "WriteHosts",
		Params: map[string]interface{}{"content": content},
	})
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errors.New(resp.GetError())
	}
	return nil
}
