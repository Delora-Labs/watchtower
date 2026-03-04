# Log Aggregation for Watchtower Agent

## Overview

The Watchtower agent should tail PM2 logs and POST them to the `/api/logs` endpoint for centralized log aggregation.

## API Endpoint

### POST /api/logs

Push logs to the Watchtower server.

**Request Body** (single log or array):

```json
{
  "server_id": "uuid-of-server",
  "app_id": "uuid-of-app",       // optional
  "app_name": "my-app",          // optional, but recommended
  "level": "info",               // info, warn, error, debug
  "message": "Log message here",
  "timestamp": "2024-03-04T12:00:00Z"  // optional, defaults to now
}
```

**Batch Example:**

```json
[
  {"server_id": "...", "app_name": "app1", "level": "info", "message": "Started"},
  {"server_id": "...", "app_name": "app1", "level": "error", "message": "Failed"}
]
```

**Response:**

```json
{
  "success": true,
  "inserted": 2
}
```

## Implementation Concept (Go)

```go
package main

import (
    "bufio"
    "bytes"
    "encoding/json"
    "net/http"
    "os/exec"
    "regexp"
    "strings"
    "time"
)

type LogEntry struct {
    ServerID  string    `json:"server_id"`
    AppID     string    `json:"app_id,omitempty"`
    AppName   string    `json:"app_name"`
    Level     string    `json:"level"`
    Message   string    `json:"message"`
    Timestamp time.Time `json:"timestamp"`
}

// Log level detection patterns
var levelPatterns = map[string]*regexp.Regexp{
    "error": regexp.MustCompile(`(?i)\b(error|err|fatal|exception|panic)\b`),
    "warn":  regexp.MustCompile(`(?i)\b(warn|warning)\b`),
    "debug": regexp.MustCompile(`(?i)\b(debug|trace)\b`),
}

func detectLevel(message string) string {
    for level, pattern := range levelPatterns {
        if pattern.MatchString(message) {
            return level
        }
    }
    return "info"
}

func tailPM2Logs(serverID string, apiURL string) {
    // Start pm2 logs with timestamp
    cmd := exec.Command("pm2", "logs", "--raw", "--timestamp")
    stdout, _ := cmd.StdoutPipe()
    cmd.Start()

    // Buffer logs for batching
    var batch []LogEntry
    ticker := time.NewTicker(2 * time.Second)

    scanner := bufio.NewScanner(stdout)
    go func() {
        for scanner.Scan() {
            line := scanner.Text()
            
            // Parse PM2 log format: "app-name | message"
            parts := strings.SplitN(line, " | ", 2)
            appName := "unknown"
            message := line
            
            if len(parts) == 2 {
                appName = strings.TrimSpace(parts[0])
                message = parts[1]
            }

            entry := LogEntry{
                ServerID:  serverID,
                AppName:   appName,
                Level:     detectLevel(message),
                Message:   message,
                Timestamp: time.Now(),
            }
            
            batch = append(batch, entry)
        }
    }()

    // Send batches periodically
    for range ticker.C {
        if len(batch) > 0 {
            sendLogs(apiURL, batch)
            batch = nil
        }
    }
}

func sendLogs(apiURL string, logs []LogEntry) error {
    data, _ := json.Marshal(logs)
    
    resp, err := http.Post(apiURL+"/api/logs", "application/json", bytes.NewReader(data))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    return nil
}

// In main(), add alongside heartbeat:
// go tailPM2Logs(serverID, apiURL)
```

## Key Points

1. **Tail PM2 logs** using `pm2 logs --raw --timestamp`
2. **Parse app name** from the log line prefix
3. **Detect log level** from message content (error, warn, debug keywords)
4. **Batch logs** and send every 2 seconds to reduce API calls
5. **Include timestamp** for accurate log ordering
6. **Handle reconnection** if the API is temporarily unavailable

## GET /api/logs Query Parameters

For reference, the dashboard queries logs with:

| Parameter | Description |
|-----------|-------------|
| `server`  | Filter by server_id |
| `app`     | Filter by app_id or app_name |
| `level`   | Filter by log level (info/warn/error/debug) |
| `search`  | Full-text search in message |
| `limit`   | Max results (default 100, max 500) |
| `before`  | Get logs before this timestamp |
| `after`   | Get logs after this timestamp |
