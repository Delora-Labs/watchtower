const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: '46.101.215.137',
    user: 'watchtower',
    password: 'W7x!pQ9#rL2@tV6',
    database: 'watchtower',
    multipleStatements: true
  });

  try {
    // Read the migration file
    const sql = fs.readFileSync('./migrations/006_cleanup_procedures.sql', 'utf8');
    
    // MySQL doesn't support DELIMITER in client queries, so we need to run procedure creation differently
    // First, drop existing procedures
    await connection.query('DROP PROCEDURE IF EXISTS cleanup_old_logs');
    await connection.query('DROP PROCEDURE IF EXISTS cleanup_old_metrics');
    await connection.query('DROP PROCEDURE IF EXISTS cleanup_all');
    
    console.log('Dropped existing procedures');

    // Create cleanup_old_logs procedure
    await connection.query(`
      CREATE PROCEDURE cleanup_old_logs(OUT deleted_count INT)
      BEGIN
        DELETE FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
        SET deleted_count = ROW_COUNT();
      END
    `);
    console.log('Created cleanup_old_logs procedure');

    // Create cleanup_old_metrics procedure
    await connection.query(`
      CREATE PROCEDURE cleanup_old_metrics(OUT deleted_count INT)
      BEGIN
        DECLARE deleted_server_metrics INT DEFAULT 0;
        DECLARE deleted_app_metrics INT DEFAULT 0;
        
        DELETE FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
        SET deleted_server_metrics = ROW_COUNT();
        
        DELETE FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
        SET deleted_app_metrics = ROW_COUNT();
        
        SET deleted_count = deleted_server_metrics + deleted_app_metrics;
      END
    `);
    console.log('Created cleanup_old_metrics procedure');

    // Create cleanup_all procedure
    await connection.query(`
      CREATE PROCEDURE cleanup_all(OUT logs_deleted INT, OUT metrics_deleted INT)
      BEGIN
        CALL cleanup_old_logs(logs_deleted);
        CALL cleanup_old_metrics(metrics_deleted);
      END
    `);
    console.log('Created cleanup_all procedure');

    console.log('\nMigration 006_cleanup_procedures.sql completed successfully!');

    // Verify procedures exist
    const [procs] = await connection.query("SHOW PROCEDURE STATUS WHERE Db = 'watchtower'");
    console.log('\nCreated procedures:');
    procs.forEach(p => console.log(`  - ${p.Name}`));

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
