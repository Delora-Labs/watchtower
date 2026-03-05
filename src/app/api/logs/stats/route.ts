import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface TimeStats {
  total: number;
  errors: number;
  warnings: number;
}

interface AppStats {
  app_name: string;
  count: number;
  errors: number;
}

// GET /api/logs/stats - Get log statistics
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const server = searchParams.get("server");

  try {
    const serverCondition = server ? "AND server_id = ?" : "";
    const serverParams = server ? [server] : [];

    // Get counts for different time ranges
    const timeRanges = [
      { key: "1h", hours: 1 },
      { key: "6h", hours: 6 },
      { key: "24h", hours: 24 },
      { key: "7d", hours: 24 * 7 },
    ];

    const stats: Record<string, TimeStats> = {};

    for (const range of timeRanges) {
      const since = new Date(Date.now() - range.hours * 60 * 60 * 1000);
      
      const [result] = await query<{ 
        total: number; 
        errors: number; 
        warnings: number;
      }>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
          SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) as warnings
        FROM app_logs
        WHERE timestamp >= ? ${serverCondition}`,
        [since, ...serverParams]
      );

      stats[range.key] = {
        total: Number(result?.total) || 0,
        errors: Number(result?.errors) || 0,
        warnings: Number(result?.warnings) || 0,
      };
    }

    // Get breakdown by level for last 24h
    const levelBreakdown = await query<{ level: string; count: number }>(
      `SELECT level, COUNT(*) as count
       FROM app_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${serverCondition}
       GROUP BY level
       ORDER BY count DESC`,
      serverParams
    );

    // Get top apps by ERROR count (last 24h) - only apps with errors
    const topApps = await query<AppStats>(
      `SELECT 
        COALESCE(NULLIF(app_name, ''), 'unknown') as app_name,
        COUNT(*) as count,
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors
       FROM app_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) 
         AND app_name IS NOT NULL 
         AND app_name != '' 
         AND app_name != 'unknown'
         ${serverCondition ? 'AND ' + serverCondition.replace('AND ', '') : ''}
       GROUP BY app_name
       HAVING errors > 0
       ORDER BY errors DESC
       LIMIT 10`,
      serverParams
    );

    // Get error rate trend (hourly for last 24h)
    const errorTrend = await query<{ hour: string; errors: number; total: number }>(
      `SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
        COUNT(*) as total
       FROM app_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${serverCondition}
       GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
       ORDER BY hour ASC`,
      serverParams
    );

    return NextResponse.json({
      data: {
        timeRanges: stats,
        levelBreakdown: levelBreakdown.map(l => ({
          level: l.level,
          count: Number(l.count),
        })),
        topApps: topApps.map(a => ({
          app_name: a.app_name,
          count: Number(a.count),
          errors: Number(a.errors),
        })),
        errorTrend: errorTrend.map(e => ({
          hour: e.hour,
          errors: Number(e.errors),
          total: Number(e.total),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch log stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch log stats" },
      { status: 500 }
    );
  }
}
