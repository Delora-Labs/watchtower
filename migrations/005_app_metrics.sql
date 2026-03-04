-- App metrics for averaging CPU/memory over time
CREATE TABLE app_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id VARCHAR(36) NOT NULL,
  cpu_percent DECIMAL(5,2) NOT NULL,
  memory_mb INT NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_time (app_id, recorded_at)
);

-- Note: Cleanup of old metrics (older than 1 hour) is done in the heartbeat API
