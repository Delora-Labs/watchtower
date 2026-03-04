const mysql = require("mysql2/promise");
const fs = require("fs");

async function run() {
  const connection = await mysql.createConnection({
    host: "46.101.215.137",
    port: 3306,
    user: "watchtower",
    password: "W7x!pQ9#rL2@tV6",
    database: "watchtower",
    multipleStatements: true,
  });

  const schema = fs.readFileSync("schema.sql", "utf8");
  await connection.query(schema);
  console.log("Schema created successfully!");
  
  await connection.end();
}

run().catch(console.error);
