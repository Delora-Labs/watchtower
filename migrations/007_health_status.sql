-- Add health status tracking to apps table
ALTER TABLE apps 
ADD COLUMN IF NOT EXISTS health_status ENUM('healthy', 'warning', 'critical') DEFAULT 'healthy',
ADD COLUMN IF NOT EXISTS prev_restarts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS restart_velocity INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS health_reason VARCHAR(255) DEFAULT NULL;

-- Index for filtering by health status
CREATE INDEX IF NOT EXISTS idx_apps_health_status ON apps(health_status);
