-- HTTP Health Checks tables

-- Health checks configuration
CREATE TABLE IF NOT EXISTS health_checks (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    expected_status INT DEFAULT 200,
    timeout_ms INT DEFAULT 5000,
    interval_ms INT DEFAULT 60000,
    enabled BOOLEAN DEFAULT TRUE,
    headers JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enabled (enabled)
);

-- Health check results
CREATE TABLE IF NOT EXISTS health_check_results (
    id VARCHAR(36) PRIMARY KEY,
    health_check_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INT,
    status_code INT,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (health_check_id) REFERENCES health_checks(id) ON DELETE CASCADE,
    INDEX idx_check_time (health_check_id, checked_at DESC)
);
