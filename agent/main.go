package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	ServerURL string `yaml:"server_url"`
	APIKey    string `yaml:"api_key"`
	Interval  int    `yaml:"interval"` // seconds
}

type PM2Process struct {
	Name      string  `json:"name"`
	PM2ID     int     `json:"pm_id"`
	Status    string  `json:"status"` // online, stopped, errored
	CPU       float64 `json:"cpu"`
	Memory    int64   `json:"memory"` // bytes
	Uptime    int64   `json:"pm_uptime"` // ms since epoch
	Restarts  int     `json:"restart_time"`
}

type SystemMetrics struct {
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryUsedMB    int     `json:"memory_used_mb"`
	MemoryTotalMB   int     `json:"memory_total_mb"`
	DiskUsedPercent float64 `json:"disk_used_percent"`
}

type HeartbeatPayload struct {
	Hostname string         `json:"hostname"`
	OS       string         `json:"os"`
	IP       string         `json:"ip"`
	Apps     []AppStatus    `json:"apps"`
	Metrics  SystemMetrics  `json:"metrics"`
}

type AppStatus struct {
	PM2ID      int     `json:"pm2_id"`
	Name       string  `json:"name"`
	Status     string  `json:"status"`
	CPUPercent float64 `json:"cpu_percent"`
	MemoryMB   int     `json:"memory_mb"`
	UptimeMs   int64   `json:"uptime_ms"`
	Restarts   int     `json:"restarts"`
}

type Command struct {
	ID      string `json:"id"`
	AppName string `json:"app_name"`
	Action  string `json:"action"` // restart, stop, start, logs
}

type CommandResult struct {
	ID     string `json:"id"`
	Status string `json:"status"` // success, failed
	Result string `json:"result"`
}

var config Config

func main() {
	configPath := flag.String("config", "/etc/watchtower/config.yaml", "Path to config file")
	flag.Parse()

	if err := loadConfig(*configPath); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Watchtower Agent starting...")
	log.Printf("Server: %s", config.ServerURL)
	log.Printf("Interval: %ds", config.Interval)

	ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)
	defer ticker.Stop()

	// Initial heartbeat
	sendHeartbeat()
	checkCommands()

	for range ticker.C {
		sendHeartbeat()
		checkCommands()
	}
}

func loadConfig(path string) error {
	// Try environment variables first
	if url := os.Getenv("WATCHTOWER_URL"); url != "" {
		config.ServerURL = url
		config.APIKey = os.Getenv("WATCHTOWER_API_KEY")
		config.Interval = 30
		if interval := os.Getenv("WATCHTOWER_INTERVAL"); interval != "" {
			fmt.Sscanf(interval, "%d", &config.Interval)
		}
		return nil
	}

	// Try config file
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("cannot read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("cannot parse config: %w", err)
	}

	if config.Interval == 0 {
		config.Interval = 30
	}

	return nil
}

func sendHeartbeat() {
	payload := HeartbeatPayload{
		Hostname: getHostname(),
		OS:       runtime.GOOS,
		IP:       getLocalIP(),
		Apps:     getPM2Status(),
		Metrics:  getSystemMetrics(),
	}

	data, _ := json.Marshal(payload)
	
	req, err := http.NewRequest("POST", config.ServerURL+"/api/heartbeat", bytes.NewReader(data))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", config.APIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Heartbeat error %d: %s", resp.StatusCode, string(body))
	} else {
		log.Printf("Heartbeat sent (%d apps)", len(payload.Apps))
	}
}

func checkCommands() {
	req, err := http.NewRequest("GET", config.ServerURL+"/api/commands/pending", nil)
	if err != nil {
		return
	}
	req.Header.Set("X-API-Key", config.APIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return
	}

	var commands []Command
	if err := json.NewDecoder(resp.Body).Decode(&commands); err != nil {
		return
	}

	for _, cmd := range commands {
		result := executeCommand(cmd)
		reportCommandResult(result)
	}
}

func executeCommand(cmd Command) CommandResult {
	result := CommandResult{ID: cmd.ID, Status: "success"}

	switch cmd.Action {
	case "restart":
		out, err := exec.Command("pm2", "restart", cmd.AppName).CombinedOutput()
		if err != nil {
			result.Status = "failed"
			result.Result = fmt.Sprintf("%s: %v", string(out), err)
		} else {
			result.Result = string(out)
		}

	case "stop":
		out, err := exec.Command("pm2", "stop", cmd.AppName).CombinedOutput()
		if err != nil {
			result.Status = "failed"
			result.Result = fmt.Sprintf("%s: %v", string(out), err)
		} else {
			result.Result = string(out)
		}

	case "start":
		out, err := exec.Command("pm2", "start", cmd.AppName).CombinedOutput()
		if err != nil {
			result.Status = "failed"
			result.Result = fmt.Sprintf("%s: %v", string(out), err)
		} else {
			result.Result = string(out)
		}

	case "logs":
		// Get last 100 lines
		out, err := exec.Command("pm2", "logs", cmd.AppName, "--lines", "100", "--nostream").CombinedOutput()
		if err != nil {
			result.Status = "failed"
			result.Result = fmt.Sprintf("%s: %v", string(out), err)
		} else {
			result.Result = string(out)
		}

	default:
		result.Status = "failed"
		result.Result = fmt.Sprintf("Unknown action: %s", cmd.Action)
	}

	log.Printf("Executed %s on %s: %s", cmd.Action, cmd.AppName, result.Status)
	return result
}

func reportCommandResult(result CommandResult) {
	data, _ := json.Marshal(result)
	
	req, err := http.NewRequest("POST", config.ServerURL+"/api/commands/"+result.ID+"/result", bytes.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", config.APIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to report command result: %v", err)
		return
	}
	resp.Body.Close()
}

func getPM2Status() []AppStatus {
	out, err := exec.Command("pm2", "jlist").Output()
	if err != nil {
		log.Printf("PM2 error: %v", err)
		return nil
	}

	var processes []struct {
		Name   string `json:"name"`
		PM2ID  int    `json:"pm_id"`
		Monit  struct {
			CPU    float64 `json:"cpu"`
			Memory int64   `json:"memory"`
		} `json:"monit"`
		PM2Env struct {
			Status       string `json:"status"`
			PMUptime     int64  `json:"pm_uptime"`
			RestartTime  int    `json:"restart_time"`
		} `json:"pm2_env"`
	}

	if err := json.Unmarshal(out, &processes); err != nil {
		log.Printf("PM2 parse error: %v", err)
		return nil
	}

	apps := make([]AppStatus, len(processes))
	for i, p := range processes {
		uptime := int64(0)
		if p.PM2Env.PMUptime > 0 {
			uptime = time.Now().UnixMilli() - p.PM2Env.PMUptime
		}
		apps[i] = AppStatus{
			PM2ID:      p.PM2ID,
			Name:       p.Name,
			Status:     p.PM2Env.Status,
			CPUPercent: p.Monit.CPU,
			MemoryMB:   int(p.Monit.Memory / 1024 / 1024),
			UptimeMs:   uptime,
			Restarts:   p.PM2Env.RestartTime,
		}
	}
	return apps
}

func getSystemMetrics() SystemMetrics {
	metrics := SystemMetrics{}

	// CPU - simple approach using /proc/stat
	if runtime.GOOS == "linux" {
		if data, err := os.ReadFile("/proc/loadavg"); err == nil {
			var load1 float64
			fmt.Sscanf(string(data), "%f", &load1)
			// Rough CPU % based on 1-min load avg
			numCPU := float64(runtime.NumCPU())
			metrics.CPUPercent = (load1 / numCPU) * 100
			if metrics.CPUPercent > 100 {
				metrics.CPUPercent = 100
			}
		}

		// Memory from /proc/meminfo
		if data, err := os.ReadFile("/proc/meminfo"); err == nil {
			lines := strings.Split(string(data), "\n")
			memTotal, memAvail := 0, 0
			for _, line := range lines {
				if strings.HasPrefix(line, "MemTotal:") {
					fmt.Sscanf(line, "MemTotal: %d kB", &memTotal)
				} else if strings.HasPrefix(line, "MemAvailable:") {
					fmt.Sscanf(line, "MemAvailable: %d kB", &memAvail)
				}
			}
			metrics.MemoryTotalMB = memTotal / 1024
			metrics.MemoryUsedMB = (memTotal - memAvail) / 1024
		}

		// Disk usage
		out, err := exec.Command("df", "-h", "/").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			if len(lines) > 1 {
				fields := strings.Fields(lines[1])
				if len(fields) >= 5 {
					pct := strings.TrimSuffix(fields[4], "%")
					fmt.Sscanf(pct, "%f", &metrics.DiskUsedPercent)
				}
			}
		}
	}

	return metrics
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func getLocalIP() string {
	// Try to get the main IP
	out, err := exec.Command("hostname", "-I").Output()
	if err == nil {
		ips := strings.Fields(string(out))
		if len(ips) > 0 {
			return ips[0]
		}
	}
	return ""
}

// Install as systemd service
func installService() error {
	service := `[Unit]
Description=Watchtower Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/watchtower-agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`

	configDir := "/etc/watchtower"
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	// Write service file
	servicePath := "/etc/systemd/system/watchtower-agent.service"
	if err := os.WriteFile(servicePath, []byte(service), 0644); err != nil {
		return err
	}

	// Copy binary
	exe, _ := os.Executable()
	destPath := "/usr/local/bin/watchtower-agent"
	input, _ := os.ReadFile(exe)
	os.WriteFile(destPath, input, 0755)

	// Create default config
	defaultConfig := filepath.Join(configDir, "config.yaml")
	if _, err := os.Stat(defaultConfig); os.IsNotExist(err) {
		cfg := `# Watchtower Agent Config
server_url: "https://watchtower.deloralabs.com"
api_key: "YOUR_API_KEY_HERE"
interval: 30
`
		os.WriteFile(defaultConfig, []byte(cfg), 0644)
	}

	fmt.Println("Service installed. Run:")
	fmt.Println("  sudo systemctl daemon-reload")
	fmt.Println("  sudo systemctl enable watchtower-agent")
	fmt.Println("  sudo systemctl start watchtower-agent")
	return nil
}
