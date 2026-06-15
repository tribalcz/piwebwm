package main

import (
	"log"
	"os"
	"strings"
	"time"

	"rpi-desktop/host-client"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var (
	hostClient *hostclient.HostAgentClient
	useMock    bool
)

func main() {
	// Subcommands (utilities that don't start the server).
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "hashpw":
			os.Exit(runHashpw(os.Args[2:]))
		}
	}

	// Authentication must be configured before we accept any traffic.
	auth, err := buildAuthenticator()
	if err != nil {
		log.Fatalf("❌ Authentication setup failed: %v", err)
	}
	log.Println("🔐 Authentication source:", auth.Name())

	sessions := NewSessionStore()
	limiter := newLoginLimiter()

	r := gin.Default()

	// CORS: locked down by default. Cross-origin browser access is only
	// enabled when WEBDESK_ALLOWED_ORIGINS (comma-separated) is set, and then
	// with credentials so the session cookie is allowed. In the default setup
	// the frontend is same-origin (served by this backend, or proxied by Vite
	// server-side), so no permissive CORS is needed.
	if origins := os.Getenv("WEBDESK_ALLOWED_ORIGINS"); origins != "" {
		corsConfig := cors.DefaultConfig()
		corsConfig.AllowOrigins = strings.Split(origins, ",")
		corsConfig.AllowCredentials = true
		corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
		corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
		r.Use(cors.New(corsConfig))
	}

	socketPath := os.Getenv("HOST_AGENT_SOCKET")
	if socketPath == "" {
		socketPath = "/var/run/webdesk.sock"
	}

	if _, err := os.Stat(socketPath); err == nil {
		client := hostclient.NewHostAgentClient(socketPath)
		if err := client.Ping(); err == nil {
			log.Println("✅ Connected to Host Agent at", socketPath)
			hostClient = client
			useMock = false
		} else {
			log.Println("⚠️  Host Agent socket exists but ping failed:", err)
			log.Println("📦 Using MOCK data")
			useMock = true
		}
	} else {
		log.Println("⚠️  Host Agent socket not found at", socketPath)
		log.Println("📦 Using MOCK data")
		useMock = true
	}

	api := r.Group("/api")
	{
		// Public auth endpoints.
		api.POST("/login", loginHandler(auth, sessions, limiter))
		api.POST("/logout", logoutHandler(sessions))
		api.GET("/me", meHandler(sessions))

		api.GET("/time", getTime)

		// Everything below requires a valid session.
		authed := api.Group("")
		authed.Use(authMiddleware(sessions))
		{
			files := authed.Group("/files")
			{
				files.GET("/list", listFiles)
				files.GET("/read", readFile)
				files.POST("/create", createFile)
				files.POST("/move", moveFile)
				files.DELETE("/delete", deleteFile)
			}

			system := authed.Group("/system")
			{
				system.GET("/info", getSystemInfo)
				system.GET("/processes", getProcesses)
				system.GET("/network/status", getNetworkStatus)
				system.GET("/network/interfaces", getNetworkInterfaces)
				system.GET("/network/routes", getNetworkRoutes)
				system.POST("/network/hostname", setHostname)
				system.POST("/network/interface", setInterfaceConfig)
				system.POST("/network/confirm", confirmNetworkConfig)
				system.POST("/network/route", addRoute)
				system.DELETE("/network/route", deleteRoute)
				system.POST("/network/interface/state", setInterfaceState)
				system.POST("/network/interface/mtu", setMtu)
				system.GET("/network/interface/lease", dhcpLease)
				system.GET("/network/wifi/scan", wifiScan)
				system.POST("/network/wifi/connect", wifiConnect)
				system.POST("/network/wifi/forget", wifiForget)
				system.POST("/network/diagnostic", networkDiagnostic)
			}
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"backend":   "go",
			"host_mode": !useMock,
			"time":      time.Now().Unix(),
		})
	})

	r.Use(func(c *gin.Context) {
		path := c.Request.URL.Path

		if c.Writer.Written() {
			return
		}

		if strings.HasPrefix(path, "/api/") || path == "/health" {
			c.Next()
			return
		}

		if path == "/" {
			c.File("/app/frontend/index.html")
			return
		}

		filePath := "/app/frontend" + path

		if strings.HasSuffix(path, ".js") {
			c.Header("Content-Type", "application/javascript; charset=utf-8")
		} else if strings.HasSuffix(path, ".css") {
			c.Header("Content-Type", "text/css; charset=utf-8")
		} else if strings.HasSuffix(path, ".html") {
			c.Header("Content-Type", "text/html; charset=utf-8")
		}

		c.File(filePath)
	})

	log.Println("🚀 WebDesk Backend started on :8080")
	r.Run(":8080")
}

func getTime(c *gin.Context) {
	c.JSON(200, gin.H{
		"time": time.Now().Format("15:04:05"),
		"date": time.Now().Format("2006-01-02"),
	})
}
