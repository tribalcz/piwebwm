package main

import (
	"log"

	"github.com/gin-gonic/gin"
)

func listFiles(c *gin.Context) {
	path := c.DefaultQuery("path", "/home")

	files, err := hostClient.ListFiles(path)
	if err != nil {
		log.Printf("Error listing files: %v", err)
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"path":  path,
		"files": files,
	})
}

func readFile(c *gin.Context) {
	path := c.Query("path")

	content, size, err := hostClient.ReadFile(path)
	if err != nil {
		log.Printf("Error reading file: %v", err)
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"path":    path,
		"content": content,
		"size":    size,
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

	var err error
	if req.IsDir {
		err = hostClient.CreateDir(req.Path)
	} else {
		err = hostClient.WriteFile(req.Path, req.Content)
	}

	if err != nil {
		log.Printf("Error creating file: %v", err)
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"path":    req.Path,
		"message": "Created successfully",
	})
}

func deleteFile(c *gin.Context) {
	path := c.Query("path")

	err := hostClient.DeleteFile(path)
	if err != nil {
		log.Printf("Error deleting file: %v", err)
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"path":    path,
		"message": "Deleted successfully",
	})
}

func moveFile(c *gin.Context) {
	var req struct {
		From string `json:"from"`
		To   string `json:"to"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	err := hostClient.MoveFile(req.From, req.To)
	if err != nil {
		log.Printf("Error moving file: %v", err)
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "Moved successfully",
	})
}

func getSystemInfo(c *gin.Context) {
	// TODO: Implement real system info
}

func getProcesses(c *gin.Context) {
	// TODO: Implement real process list
}
