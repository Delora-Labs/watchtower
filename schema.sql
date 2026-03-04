-- Watchtower Database Schema

-- Servers (each agent reports from a server)
CREATE TABLE IF NOT EXISTS servers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    os VARCHAR(50),
    hostname VARCHAR(100),
    last_heartbeat DATETIME,
    is_online BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_api_key (api_key),
    INDEX idx_last_heartbeat (last_heartbeat)
);

-- Apps (PM2 processes or Windows services)
CREATE TABLE IF NOT EXISTS apps (
    id VARCHAR(36) PRIMARY KEY,
    server_id VARCHAR(36) NOT NULL,
    pm2_id INT,
    pm2_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    url VARCHAR(255),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'unknown',
    cpu_percent DECIMAL(5,2) DEFAULT 0,
    memory_mb INT DEFAULT 0,
    uptime_ms BIGINT DEFAULT 0,
    restarts INT DEFAULT 0,
    last_seen DATETIME,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE KEY uk_server_pm2 (server_id, pm2_name),
    INDEX idx_server_id (server_id),
    INDEX idx_status (status)
);

-- Server metrics history (for charts)
CREATE TABLE IF NOT EXISTS server_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(36) NOT NULL,
    cpu_percent DECIMAL(5,2),
    memory_used_mb INT,
    memory_total_mb INT,
    disk_used_percent DECIMAL(5,2),
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_recorded (server_id, recorded_at)
);

-- Pending commands (dashboard → agent)
CREATE TABLE IF NOT EXISTS commands (
    id VARCHAR(36) PRIMARY KEY,
    server_id VARCHAR(36) NOT NULL,
    app_name VARCHAR(100),
    action VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_status (server_id, status)
);

-- Alerts/incidents
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY,
    server_id VARCHAR(36),
    app_id VARCHAR(36),
    type VARCHAR(50) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'warning',
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_unresolved (is_resolved, created_at)
);
