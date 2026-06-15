package main

import (
	"log"
	"net/http"

	"rpi-desktop/host-client"

	"github.com/gin-gonic/gin"
)

// requireHostAgent guards handlers that need the host agent. When the agent is
// unavailable (mock mode), hostClient is nil; calling through it would panic,
// so we return a clean 503 instead.
func requireHostAgent(c *gin.Context) bool {
	if useMock || hostClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "host agent unavailable",
		})
		return false
	}
	return true
}

func listFiles(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	path := c.DefaultQuery("path", "/home")

	files, err := hostClient.ListFiles(path)
	if err != nil {
		log.Printf("Error listing files: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":  path,
		"files": files,
	})
}

func readFile(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	path := c.Query("path")

	content, size, err := hostClient.ReadFile(path)
	if err != nil {
		log.Printf("Error reading file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":    path,
		"content": content,
		"size":    size,
	})
}

func createFile(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
		IsDir   bool   `json:"isDir"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var err error
	if req.IsDir {
		err = hostClient.CreateDir(req.Path)
	} else {
		err = hostClient.WriteFile(req.Path, req.Content)
	}

	if err != nil {
		log.Printf("Error creating file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"path":    req.Path,
		"message": "Created successfully",
	})
}

func deleteFile(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	path := c.Query("path")

	err := hostClient.DeleteFile(path)
	if err != nil {
		log.Printf("Error deleting file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"path":    path,
		"message": "Deleted successfully",
	})
}

func moveFile(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		From string `json:"from"`
		To   string `json:"to"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	err := hostClient.MoveFile(req.From, req.To)
	if err != nil {
		log.Printf("Error moving file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to move"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Moved successfully",
	})
}

func getSystemInfo(c *gin.Context) {
	// TODO: Implement real system info
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func getProcesses(c *gin.Context) {
	// TODO: Implement real process list
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func getNetworkStatus(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	status, err := hostClient.NetworkStatus()
	if err != nil {
		log.Printf("Error reading network status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read network status"})
		return
	}

	c.JSON(http.StatusOK, status)
}

func getNetworkInterfaces(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	interfaces, err := hostClient.NetworkInterfaces()
	if err != nil {
		log.Printf("Error reading network interfaces: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read interfaces"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"interfaces": interfaces})
}

func getNetworkRoutes(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	routes, err := hostClient.RoutingTable()
	if err != nil {
		log.Printf("Error reading routing table: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read routes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"routes": routes})
}

func setHostname(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.SetHostname(req.Name); err != nil {
		log.Printf("Error setting hostname: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "hostname": req.Name})
}

func setInterfaceConfig(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface         string   `json:"iface"`
		Method        string   `json:"method"`
		Address       *string  `json:"address"`
		Prefixlen     *int     `json:"prefixlen"`
		Gateway       *string  `json:"gateway"`
		DNS           []string `json:"dns"`
		DNSSearch     []string `json:"dns_search"`
		RevertSeconds uint64   `json:"revert_seconds"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	token, secs, err := hostClient.SetInterfaceConfig(hostclient.InterfaceConfigRequest{
		Iface:         req.Iface,
		Method:        req.Method,
		Address:       req.Address,
		Prefixlen:     req.Prefixlen,
		Gateway:       req.Gateway,
		DNS:           req.DNS,
		DNSSearch:     req.DNSSearch,
		RevertSeconds: req.RevertSeconds,
	})
	if err != nil {
		log.Printf("Error applying interface config: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "revert_seconds": secs})
}

func confirmNetworkConfig(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.ConfirmNetworkConfig(req.Token); err != nil {
		log.Printf("Error confirming network config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func addRoute(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface   string  `json:"iface"`
		Dst     string  `json:"dst"`
		Gateway *string `json:"gateway"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.AddRoute(req.Iface, req.Dst, req.Gateway); err != nil {
		log.Printf("Error adding route: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func deleteRoute(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface   string  `json:"iface"`
		Dst     string  `json:"dst"`
		Gateway *string `json:"gateway"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.DeleteRoute(req.Iface, req.Dst, req.Gateway); err != nil {
		log.Printf("Error deleting route: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func setInterfaceState(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface string `json:"iface"`
		Up    bool   `json:"up"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.SetInterfaceState(req.Iface, req.Up); err != nil {
		log.Printf("Error setting interface state: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func setMtu(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface string `json:"iface"`
		MTU   uint32 `json:"mtu"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.SetMtu(req.Iface, req.MTU); err != nil {
		log.Printf("Error setting MTU: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func wifiScan(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	iface := c.Query("iface")
	nets, err := hostClient.WifiScan(iface)
	if err != nil {
		log.Printf("Error scanning Wi-Fi: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"networks": nets})
}

func wifiConnect(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Iface    string  `json:"iface"`
		SSID     string  `json:"ssid"`
		Password *string `json:"password"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.WifiConnect(req.Iface, req.SSID, req.Password); err != nil {
		log.Printf("Error connecting Wi-Fi: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func wifiForget(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		SSID string `json:"ssid"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := hostClient.WifiForget(req.SSID); err != nil {
		log.Printf("Error forgetting Wi-Fi: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func networkDiagnostic(c *gin.Context) {
	if !requireHostAgent(c) {
		return
	}

	var req struct {
		Tool  string `json:"tool"` // "ping" | "traceroute" | "dns"
		Host  string `json:"host"`
		Count uint8  `json:"count"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var (
		output string
		err    error
	)
	switch req.Tool {
	case "ping":
		count := req.Count
		if count == 0 {
			count = 4
		}
		output, err = hostClient.Ping4(req.Host, count)
	case "traceroute":
		output, err = hostClient.Traceroute(req.Host)
	case "dns":
		output, err = hostClient.DnsLookup(req.Host)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown diagnostic tool"})
		return
	}
	if err != nil {
		log.Printf("Error running diagnostic %s: %v", req.Tool, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"output": output})
}
