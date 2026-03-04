import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

interface HealthCheckResult {
  id: number;
  health_check_id: string;
  status: "up" | "down" | "timeout";
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: Date;
}

interface HealthCheck {
  id: string;
  name: string;
}

// GET recent results for a health check
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const since = searchParams.get("since"); // ISO date string

    // Verify health check exists
    const healthCheck = await queryOne<HealthCheck>(
      "SELECT id, name FROM health_checks WHERE id = ?",
      [id]
    );

    if (!healthCheck) {
      return NextResponse.json(
        { error: "Health check not found" },
        { status: 404 }
      );
    }

    let sql = `
      SELECT * FROM health_check_results 
      WHERE health_check_id = ?
    `;
    const queryParams: (string | number)[] = [id];

    if (since) {
      sql += " AND checked_at >= ?";
      queryParams.push(since);
    }

    sql += " ORDER BY checked_at DESC LIMIT ?";
    queryParams.push(limit);

    const results = await query<HealthCheckResult>(sql, queryParams);

    // Calculate summary stats
    const total = results.length;
    const upCount = results.filter((r) => r.status === "up").length;
    const downCount = results.filter((r) => r.status === "down").length;
    const timeoutCount = results.filter((r) => r.status === "timeout").length;
    const avgResponseTime =
      total > 0
        ? Math.round(
            results
              .filter((r) => r.response_time_ms !== null)
              .reduce((sum, r) => sum + (r.response_time_ms || 0), 0) /
              results.filter((r) => r.response_time_ms !== null).length || 0
          )
        : null;

    return NextResponse.json({
      data: results,
      summary: {
        total,
        up: upCount,
        down: downCount,
        timeout: timeoutCount,
        uptime_percent: total > 0 ? Math.round((upCount / total) * 100) : null,
        avg_response_time_ms: avgResponseTime,
      },
      health_check: healthCheck,
    });
  } catch (error) {
    console.error("Get health check results error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
