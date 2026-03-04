import mysql, { RowDataPacket, ResultSetHeader } from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryParams = any[];

export async function query<T = RowDataPacket>(
  sql: string,
  params?: QueryParams
): Promise<T[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params || []);
  return rows as T[];
}

export async function queryOne<T = RowDataPacket>(
  sql: string,
  params?: QueryParams
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

export async function execute(
  sql: string,
  params?: QueryParams
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params || []);
  return result;
}

export default pool;
