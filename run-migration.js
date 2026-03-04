const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const conn = await mysql.createConnection({
    host: '46.101.215.137',
    user: 'watchtower',
    password: 'W7x!pQ9#rL2@tV6',
    database: 'watchtower',
    multipleStatements: true
  });

  const migrationFile = process.argv[2] || 'migrations/002_auth_and_teams.sql';
  const sql = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
  
  console.log(`Running migration: ${migrationFile}`);
  
  try {
    await conn.query(sql);
    console.log('✅ Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await conn.end();
  }
}

run();
