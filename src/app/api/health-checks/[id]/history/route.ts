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
       LIMIT 1000`,
      [id, days]
    );

    // Calculate uptime stats for different periods (7, 30, 90 days)
    const uptimeStats = await query<UptimeStats>(`
      SELECT 
        CASE 
          WHEN checked_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN '7d'
          WHEN checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN '30d'
          ELSE '90d'
        END as period,
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks,
        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_checks,
        ROUND(SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as uptime_percent,
        ROUND(AVG(CASE WHEN status = 'up' THEN response_time_ms ELSE NULL END), 0) as avg_response_time_ms
      FROM health_check_results
      WHERE health_check_id = ?
        AND checked_at > DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY CASE 
        WHEN checked_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN '7d'
        WHEN checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN '30d'
        ELSE '90d'
      END
    `, [id]);

    // Aggregate data for charts (hourly for last 24h, daily for longer)
    const chartData = await query<{
      time_bucket: string;
      avg_response_time: number;
      up_count: number;
      down_count: number;
      total_count: number;
    }>(`
      SELECT 
        DATE_FORMAT(
          DATE_SUB(checked_at, INTERVAL MINUTE(checked_at) % 60 MINUTE),
          '%Y-%m-%d %H:00'
        ) as time_bucket,
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

    // Get recent incidents (downtime events)
    const incidents = await query<{
      started_at: string;
      ended_at: string | null;
      duration_minutes: number | null;
      error_message: string | null;
    }>(`
      SELECT 
        MIN(checked_at) as started_at,
        MAX(checked_at) as ended_at,
        TIMESTAMPDIFF(MINUTE, MIN(checked_at), MAX(checked_at)) as duration_minutes,
        MAX(error_message) as error_message
      FROM (
        SELECT 
          checked_at,
          error_message,
          @group := IF(status = 'down' AND @prev_status = 'up', @group + 1, @group) as incident_group,
          @prev_status := status
        FROM health_check_results,
          (SELECT @group := 0, @prev_status := 'up') vars
        WHERE health_check_id = ?
          AND checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY checked_at ASC
      ) grouped
      WHERE @prev_status = 'down' OR (SELECT status FROM health_check_results WHERE health_check_id = ? ORDER BY checked_at DESC LIMIT 1) = 'down'
      GROUP BY incident_group
      HAVING COUNT(*) > 0
      ORDER BY started_at DESC
      LIMIT 10
    `, [id, id]);

    return NextResponse.json({
      healthCheck: healthCheck[0],
      results: results.slice(0, 100), // Latest 100 for detail view
      uptimeStats,
      chartData,
      incidents,
    });
  } catch (error) {
    console.error("Error fetching health check history:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
