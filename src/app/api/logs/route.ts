import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

interface LogRow {
  id: number;
  server_id: string;
  app_id: string | null;
  app_name: string | null;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  server_name?: string;
}

// GET /api/logs - Fetch logs with filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const server = searchParams.get("server");
  const app = searchParams.get("app");
  const level = searchParams.get("level");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (server) {
    conditions.push("l.server_id = ?");
    params.push(server);
  }

  if (app) {
    conditions.push("(l.app_id = ? OR l.app_name = ?)");
    params.push(app, app);
  }

  if (level) {
    conditions.push("l.level = ?");
    params.push(level);
  }

  if (search) {
    conditions.push("l.message LIKE ?");
    params.push(`%${search}%`);
  }

  if (before) {
    conditions.push("l.timestamp < ?");
    params.push(before);
  }

  if (after) {
    conditions.push("l.timestamp > ?");
    params.push(after);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Note: LIMIT is interpolated directly because MySQL prepared statements
  // have issues with LIMIT as a parameter in some configurations.
  // The value is already validated as a number (1-500) above.
  const sql = `
    SELECT 
      l.id, l.server_id, l.app_id, l.app_name, l.level, l.message, l.timestamp,
      s.name as server_name
    FROM app_logs l
    LEFT JOIN servers s ON l.server_id = s.id
    ${whereClause}
    ORDER BY l.timestamp DESC, l.id DESC
    LIMIT ${limit}
  `;

  try {
    const rows = await query<LogRow>(sql, params);

    return NextResponse.json({
      data: rows.reverse(), // Return in chronological order
      count: rows.length,
    });
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

// POST /api/logs - Push logs (for agents)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support single log or batch
    const logs = Array.isArray(body) ? body : [body];

    if (logs.length === 0) {
      return NextResponse.json({ error: "No logs provided" }, { status: 400 });
    }

    // Validate required fields
    for (const log of logs) {
      if (!log.server_id) {
        return NextResponse.json(
          { error: "server_id is required" },
          { status: 400 }
        );
      }
    }

    // Insert logs in batch
    const values = logs.map((log) => [
      log.server_id,
      log.app_id || null,
      log.app_name || null,
      log.level || "info",
      log.message || "",
      log.timestamp ? new Date(log.timestamp) : new Date(),
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();

    const result = await execute(
      `INSERT INTO app_logs (server_id, app_id, app_name, level, message, timestamp) VALUES ${placeholders}`,
      flatValues
    );

    return NextResponse.json({
      success: true,
      inserted: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to insert logs:", error);
    return NextResponse.json(
      { error: "Failed to insert logs" },
      { status: 500 }
    );
  }
}
