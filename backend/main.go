package main

import (
    "log"
    "time"
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    // API endpoint
    r.GET("/api/time", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "time": time.Now().Format("15:04:05"),
            "date": time.Now().Format("2006-01-02"),
        })
    })

    r.Static("/static", "/app/frontend")
    r.NoRoute(func(c *gin.Context) {
        c.File("/app/frontend/index.html")
    })

    log.Println("Server starting on :8080")
    r.Run(":8080")
}
