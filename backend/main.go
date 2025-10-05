// backend/main.go
package main

import (
    "log"
    "strings"
    "time"
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    // Custom static file handler with correct MIME types
    r.Use(func(c *gin.Context) {
        path := c.Request.URL.Path

        // Skip API routes
        if strings.HasPrefix(path, "/api/") {
            c.Next()
            return
        }

        // Serve index.html for root
        if path == "/" {
            c.File("/app/frontend/index.html")
            return
        }

        // Determine file path
        filePath := "/app/frontend/" + path

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

    log.Println("Server starting on :8080")
    r.Run(":8080")
}