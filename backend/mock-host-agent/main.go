package main

import (
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type FileItem struct {
	Name     string `json:"name"`
	Type     string `json:"type"` //file or dir
	Size     int64  `json:"size"`
	Modified int64  `json:"modified"`
	Path     string `json:"path"`
}

type SystemInfo struct {
	CPU       float64 `json:"cpu"`
	Memory    float64 `json:"memory"`
	Disk      float64 `json:"disk"`
	Uptime    int64   `json:"uptime"`
	Hostname  string  `json:"hostname"`
	Processes int     `json:"processes"`
}

type Process struct {
	PID     int     `json:"pid"`
	Name    string  `json:"name"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Status  string  `json:"status"`
	Command string  `json:"command"`
}

func main() {
	r := gin.Default()

	//CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE"}
	r.Use(cors.New(config))

	// Static file serving middleware
	r.Use(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Skip API routes
		if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/files/") ||
			strings.HasPrefix(path, "/system/") ||
			strings.HasPrefix(path, "/health") {
			c.Next()
			return
		}

		// Serve index.html for root
		if path == "/" {
			c.File("/app/frontend/index.html")
			return
		}

		// Determine file path
		filePath := "/app/frontend" + path

		// Set correct MIME type for JS modules
		if strings.HasSuffix(path, ".js") {
			c.Header("Content-Type", "application/javascript")
		} else if strings.HasSuffix(path, ".css") {
			c.Header("Content-Type", "text/css")
		}

		// Serve the file
		c.File(filePath)
	})

	// API endpoint pro čas
	r.GET("/api/time", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"time": time.Now().Format("15:04:05"),
			"date": time.Now().Format("2006-01-02"),
		})
	})

	//Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"agent":  "webdesk-backend",
			"time":   time.Now().Unix(),
		})
	})

	//Files API
	files := r.Group("/api/files")
	{
		files.GET("/list", listFiles)
		files.GET("/read", readFile)
		files.POST("/create", createFile)
		files.DELETE("/delete", deleteFile)
	}

	//System API
	system := r.Group("/api/system")
	{
		system.GET("/info", getSystemInfo)
		system.GET("/processes", getProcesses)
	}

	log.Println("WebDesk Backend started on :8080")
	r.Run(":8080")
}

func listFiles(c *gin.Context) {
	path := c.DefaultQuery("path", "/home")

	//Mock data
	var files []FileItem

	if path == "/home" || path == "/" {
		files = []FileItem{
			{Name: "Documents", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Documents"},
			{Name: "Pictures", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Pictures"},
			{Name: "Downloads", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Downloads"},
			{Name: "Music", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Music"},
			{Name: "Videos", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Videos"},
			{Name: "readme.txt", Type: "file", Size: 1024, Modified: time.Now().Unix(), Path: "/home/readme.txt"},
			{Name: "notes.md", Type: "file", Size: 2048, Modified: time.Now().Unix(), Path: "/home/notes.md"},
			{Name: "script.sh", Type: "file", Size: 512, Modified: time.Now().Unix(), Path: "/home/script.sh"},
		}
	} else if path == "/home/Documents" {
		files = []FileItem{
			{Name: "Work", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Documents/Work"},
			{Name: "Personal", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home/Documents/Personal"},
			{Name: "project.pdf", Type: "file", Size: 15360, Modified: time.Now().Unix(), Path: "/home/Documents/project.pdf"},
			{Name: "report.docx", Type: "file", Size: 8192, Modified: time.Now().Unix(), Path: "/home/Documents/report.docx"},
		}
	} else if path == "/home/Pictures" {
		files = []FileItem{
			{Name: "vacation.jpg", Type: "file", Size: 2457600, Modified: time.Now().Unix(), Path: "/home/Pictures/vacation.jpg"},
			{Name: "screenshot.png", Type: "file", Size: 1228800, Modified: time.Now().Unix(), Path: "/home/Pictures/screenshot.png"},
			{Name: "wallpaper.jpg", Type: "file", Size: 3145728, Modified: time.Now().Unix(), Path: "/home/Pictures/wallpaper.jpg"},
		}
	} else {
		files = []FileItem{
			{Name: "..", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: "/home"},
			{Name: "empty_folder", Type: "dir", Size: 0, Modified: time.Now().Unix(), Path: path + "/empty_folder"},
			{Name: "sample.txt", Type: "file", Size: 256, Modified: time.Now().Unix(), Path: path + "/sample.txt"},
		}
	}

	c.JSON(200, gin.H{
		"path":  path,
		"files": files,
	})
}

func readFile(c *gin.Context) {
	path := c.Query("path")

	content := ""
	if path == "/home/readme.txt" {
		content = "This is a mock file content from the Mock Host Agent.\n\nWelcome to WebDesk OS!\n\nThis file is served from a simulated filesystem."
	} else if path == "/home/notes.md" {
		content = "# Notes\n\n## Todo\n- [ ] Implement real host agent\n- [ ] Add file upload\n- [ ] Terminal emulator\n\n## Ideas\n- Dark mode\n- File preview\n- Code editor"
	} else {
		content = "Mock file content for: " + path
	}

	c.JSON(200, gin.H{
		"path":    path,
		"content": content,
		"size":    len(content),
	})
}

func createFile(c *gin.Context) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
		IsDir   bool   `json:"isDir"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	log.Printf("Mock: Creating %s at %s", map[bool]string{true: "directory", false: "file"}[req.IsDir], req.Path)

	c.JSON(200, gin.H{
		"success": true,
		"path":    req.Path,
		"message": "File created (mock)",
	})
}

func deleteFile(c *gin.Context) {
	path := c.Query("path")

	log.Printf("Mock: Deleting %s", path)

	c.JSON(200, gin.H{
		"success": true,
		"path":    path,
		"message": "File deleted (mock)",
	})
}

func getSystemInfo(c *gin.Context) {
	rand.Seed(time.Now().UnixNano())

	info := SystemInfo{
		CPU:       rand.Float64()*40 + 20,
		Memory:    rand.Float64()*30 + 50,
		Disk:      rand.Float64()*20 + 40,
		Uptime:    time.Now().Unix() - 86400*3,
		Hostname:  "raspberrypi",
		Processes: 127 + rand.Intn(20),
	}

	c.JSON(200, info)
}

func getProcesses(c *gin.Context) {
	processes := []Process{
		{PID: 1, Name: "systemd", CPU: 0.1, Memory: 2.3, Status: "running", Command: "/sbin/init"},
		{PID: 123, Name: "nginx", CPU: 1.2, Memory: 5.4, Status: "running", Command: "nginx: master process"},
		{PID: 456, Name: "node", CPU: 15.3, Memory: 12.8, Status: "running", Command: "node server.js"},
		{PID: 789, Name: "python3", CPU: 5.6, Memory: 8.2, Status: "running", Command: "python3 script.py"},
		{PID: 1011, Name: "docker", CPU: 2.1, Memory: 15.6, Status: "running", Command: "dockerd"},
		{PID: 1213, Name: "postgres", CPU: 3.4, Memory: 22.1, Status: "running", Command: "postgres: main"},
	}

	c.JSON(200, gin.H{
		"processes": processes,
		"count":     len(processes),
	})
}
