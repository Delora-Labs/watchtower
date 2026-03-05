import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

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

// Escape CSV field (handle commas, quotes, newlines)
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/logs/export - Export logs as CSV
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const server = searchParams.get("server");
  const app = searchParams.get("app");
  const level = searchParams.get("level");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10000"), 50000);

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

  if (from) {
    conditions.push("l.timestamp >= ?");
    params.push(from);
  }

  if (to) {
    conditions.push("l.timestamp <= ?");
    params.push(to);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      l.id, l.server_id, l.app_id, l.app_name, l.level, l.message, l.timestamp,
      s.name as server_name
    FROM app_logs l
    LEFT JOIN servers s ON l.server_id = s.id
    ${whereClause}
    ORDER BY l.timestamp ASC, l.id ASC
    LIMIT ${limit}
  `;

  try {
    const rows = await query<LogRow>(sql, params);

    // Generate CSV
    const headers = ["timestamp", "level", "server", "app", "message"];
    const csvLines: string[] = [headers.join(",")];

    for (const row of rows) {
      const line = [
        escapeCsvField(row.timestamp),
        escapeCsvField(row.level),
        escapeCsvField(row.server_name || row.server_id),
        escapeCsvField(row.app_name || ""),
        escapeCsvField(row.message),
      ].join(",");
      csvLines.push(line);
    }

    const csv = csvLines.join("\n");

    // Generate filename with date range
    const now = new Date().toISOString().slice(0, 10);
    const filename = `watchtower-logs-${now}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export logs:", error);
    return NextResponse.json(
      { error: "Failed to export logs" },
      { status: 500 }
    );
  }
}
