const mysql = require('mysql2/promise');

async function testCleanup() {
  const connection = await mysql.createConnection({
    host: '46.101.215.137',
    user: 'watchtower',
    password: 'W7x!pQ9#rL2@tV6',
    database: 'watchtower'
  });

  try {
    console.log('=== BEFORE CLEANUP ===\n');
    
    // Logs stats
    const [[logsTotal]] = await connection.query('SELECT COUNT(*) as count FROM app_logs');
    const [[logsOld]] = await connection.query('SELECT COUNT(*) as count FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const [[logsOldest]] = await connection.query('SELECT MIN(timestamp) as oldest FROM app_logs');
    console.log('LOGS:');
    console.log(`  Total: ${logsTotal.count}`);
    console.log(`  Older than 7 days: ${logsOld.count}`);
    console.log(`  Oldest record: ${logsOldest.oldest}`);

    // Server metrics stats
    const [[srvMetricsTotal]] = await connection.query('SELECT COUNT(*) as count FROM server_metrics');
    const [[srvMetricsOld]] = await connection.query('SELECT COUNT(*) as count FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const [[srvMetricsOldest]] = await connection.query('SELECT MIN(recorded_at) as oldest FROM server_metrics');
    console.log('\nSERVER METRICS:');
    console.log(`  Total: ${srvMetricsTotal.count}`);
    console.log(`  Older than 30 days: ${srvMetricsOld.count}`);
    console.log(`  Oldest record: ${srvMetricsOldest.oldest}`);

    // App metrics stats
    const [[appMetricsTotal]] = await connection.query('SELECT COUNT(*) as count FROM app_metrics');
    const [[appMetricsOld]] = await connection.query('SELECT COUNT(*) as count FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const [[appMetricsOldest]] = await connection.query('SELECT MIN(recorded_at) as oldest FROM app_metrics');
    console.log('\nAPP METRICS:');
    console.log(`  Total: ${appMetricsTotal.count}`);
    console.log(`  Older than 30 days: ${appMetricsOld.count}`);
    console.log(`  Oldest record: ${appMetricsOldest.oldest}`);

    // Run cleanup
    console.log('\n=== RUNNING CLEANUP ===\n');
    
    const [logsResult] = await connection.query('DELETE FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    console.log(`Deleted ${logsResult.affectedRows} old logs`);
    
    const [srvMetricsResult] = await connection.query('DELETE FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    console.log(`Deleted ${srvMetricsResult.affectedRows} old server metrics`);
    
    const [appMetricsResult] = await connection.query('DELETE FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    console.log(`Deleted ${appMetricsResult.affectedRows} old app metrics`);

    console.log('\n=== AFTER CLEANUP ===\n');
    
    // Verify cleanup
    const [[logsAfter]] = await connection.query('SELECT COUNT(*) as count FROM app_logs');
    const [[srvMetricsAfter]] = await connection.query('SELECT COUNT(*) as count FROM server_metrics');
    const [[appMetricsAfter]] = await connection.query('SELECT COUNT(*) as count FROM app_metrics');
    
    console.log(`Logs remaining: ${logsAfter.count}`);
    console.log(`Server metrics remaining: ${srvMetricsAfter.count}`);
    console.log(`App metrics remaining: ${appMetricsAfter.count}`);
    
    const totalDeleted = logsResult.affectedRows + srvMetricsResult.affectedRows + appMetricsResult.affectedRows;
    console.log(`\nTOTAL RECORDS DELETED: ${totalDeleted}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

testCleanup();
