-- Cleanup procedures for log and metrics retention
-- Logs: 7 days retention
-- Metrics: 30 days retention

-- Drop existing procedures if they exist
DROP PROCEDURE IF EXISTS cleanup_old_logs;
DROP PROCEDURE IF EXISTS cleanup_old_metrics;
DROP PROCEDURE IF EXISTS cleanup_all;

DELIMITER //

-- Cleanup logs older than 7 days
CREATE PROCEDURE cleanup_old_logs(OUT deleted_count INT)
BEGIN
    DELETE FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
    SET deleted_count = ROW_COUNT();
END //

-- Cleanup server_metrics older than 30 days
CREATE PROCEDURE cleanup_old_metrics(OUT deleted_count INT)
BEGIN
    DECLARE deleted_server_metrics INT DEFAULT 0;
    DECLARE deleted_app_metrics INT DEFAULT 0;
    
    DELETE FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    SET deleted_server_metrics = ROW_COUNT();
    
    DELETE FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    SET deleted_app_metrics = ROW_COUNT();
    
    SET deleted_count = deleted_server_metrics + deleted_app_metrics;
END //

-- Combined cleanup procedure
CREATE PROCEDURE cleanup_all(OUT logs_deleted INT, OUT metrics_deleted INT)
BEGIN
    CALL cleanup_old_logs(logs_deleted);
    CALL cleanup_old_metrics(metrics_deleted);
END //

DELIMITER ;
