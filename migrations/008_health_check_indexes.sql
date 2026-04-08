-- Add indexes to speed up health check queries
-- The existing idx_check_time(health_check_id, checked_at DESC) helps but is not enough

-- Covers the "get latest result per check" subquery
CREATE INDEX idx_hcr_check_checked_id ON health_check_results(health_check_id, checked_at DESC, id);

-- Covers the incidents and chart aggregation queries
CREATE INDEX idx_hcr_check_status_checked ON health_check_results(health_check_id, status, checked_at);

-- Index on health_checks for team filtering
CREATE INDEX idx_hc_team_enabled ON health_checks(team_id, enabled);
