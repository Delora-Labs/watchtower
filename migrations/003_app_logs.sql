-- App logs table for aggregated log storage
CREATE TABLE IF NOT EXISTS app_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(36) NOT NULL,
    app_id VARCHAR(36),
    app_name VARCHAR(100),
    level ENUM('info', 'warn', 'error', 'debug') DEFAULT 'info',
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_server_time (server_id, timestamp),
    INDEX idx_level (level),
    INDEX idx_app_time (app_id, timestamp)
);
