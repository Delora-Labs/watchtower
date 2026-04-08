import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface HealthCheckResult {
  id: string;
  status: "up" | "down";
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: string;
}

interface UptimeStats {
  period: string;
  total_checks: number;
  up_checks: number;
  down_checks: number;
  uptime_percent: number;
  avg_response_time_ms: number | null;
}

// GET /api/health-checks/[id]/history - Get historical data for a health check
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");

    // Get health check details
    const healthCheck = await query<{
      id: string;
      name: string;
      url: string;
      method: string;
      expected_status: number;
      timeout_ms: number;
      interval_ms: number;
      enabled: boolean;
      created_at: string;
    }>(
      "SELECT * FROM health_checks WHERE id = ?",
      [id]
    );

    if (healthCheck.length === 0) {
      return NextResponse.json({ error: "Health check not found" }, { status: 404 });
    }

    // Get results for the specified period
    const results = await query<HealthCheckResult>(
      `SELECT id, status, response_time_ms, status_code, error_message, checked_at
       FROM health_check_results
       WHERE health_check_id = ?
         AND checked_at > DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY checked_at DESC
       LIMIT 100`,
      [id, days]
    );

    // Calculate uptime stats — single scan with conditional aggregation
    const uptimeStats = await query<UptimeStats>(`
      SELECT
        period,
        total_checks,
        up_checks,
        total_checks - up_checks as down_checks,
        ROUND(up_checks * 100.0 / total_checks, 2) as uptime_percent,
        avg_response_time_ms
      FROM (
        SELECT '7d' as period,
          COUNT(*) as total_checks,
          SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks,
          ROUND(AVG(CASE WHEN status = 'up' THEN response_time_ms ELSE NULL END), 0) as avg_response_time_ms
        FROM health_check_results
        WHERE health_check_id = ? AND checked_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION ALL
        SELECT '30d',
          COUNT(*),
          SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END),
          ROUND(AVG(CASE WHEN status = 'up' THEN response_time_ms ELSE NULL END), 0)
        FROM health_check_results
        WHERE health_check_id = ? AND checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        UNION ALL
        SELECT '90d',
          COUNT(*),
          SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END),
          ROUND(AVG(CASE WHEN status = 'up' THEN response_time_ms ELSE NULL END), 0)
        FROM health_check_results
        WHERE health_check_id = ? AND checked_at > DATE_SUB(NOW(), INTERVAL 90 DAY)
      ) stats
      WHERE total_checks > 0
    `, [id, id, id]);

    // Aggregate data for charts (hourly buckets)
    const chartData = await query<{
      time_bucket: string;
      avg_response_time: number;
      up_count: number;
      down_count: number;
      total_count: number;
    }>(`
      SELECT
        DATE_FORMAT(checked_at, '%Y-%m-%d %H:00') as time_bucket,
        ROUND(AVG(CASE WHEN status = 'up' THEN response_time_ms ELSE NULL END), 0) as avg_response_time,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_count,
        COUNT(*) as total_count
      FROM health_check_results
      WHERE health_check_id = ?
        AND checked_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `, [id, days]);

    // Get recent incidents — simple approach: find consecutive down periods
    const incidents = await query<{
      started_at: string;
      ended_at: string | null;
      duration_minutes: number | null;
      error_message: string | null;
    }>(`
      SELECT
        MIN(r.checked_at) as started_at,
        MAX(r.checked_at) as ended_at,
        TIMESTAMPDIFF(MINUTE, MIN(r.checked_at), MAX(r.checked_at)) as duration_minutes,
        MAX(r.error_message) as error_message
      FROM health_check_results r
      WHERE r.health_check_id = ?
        AND r.status = 'down'
        AND r.checked_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(r.checked_at), HOUR(r.checked_at)
      ORDER BY started_at DESC
      LIMIT 10
    `, [id, days]);

    return NextResponse.json({
      healthCheck: healthCheck[0],
      results,
      uptimeStats,
      chartData,
      incidents,
    });
  } catch (error) {
    console.error("Error fetching health check history:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
