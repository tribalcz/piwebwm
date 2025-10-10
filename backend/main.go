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
	r := gin.Default()

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(corsConfig))

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
			useMock = false
		}
	} else {
		log.Println("⚠️  Host Agent socket not found at", socketPath)
		log.Println("📦 Using MOCK data")
		useMock = true
	}

	api := r.Group("/api")
	{
		api.GET("/time", getTime)

		files := api.Group("/files")
		{
			files.GET("/list", listFiles)
			files.GET("/read", readFile)
			files.POST("/create", createFile)
			files.DELETE("/delete", deleteFile)
		}

		system := api.Group("/system")
		{
			system.GET("/info", getSystemInfo)
			system.GET("/processes", getProcesses)
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
