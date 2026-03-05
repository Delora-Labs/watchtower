import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

interface CountResult {
  count: number;
}

interface OldestResult {
  oldest: Date | null;
}

// GET /api/settings/retention - Get current retention stats
export async function GET() {
  try {
    // Get logs stats
    const [logsTotal] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM app_logs"
    );
    const [logsOldCount] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const [logsOldest] = await query<OldestResult>(
      "SELECT MIN(timestamp) as oldest FROM app_logs"
    );

    // Get server_metrics stats
    const [serverMetricsTotal] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM server_metrics"
    );
    const [serverMetricsOldCount] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const [serverMetricsOldest] = await query<OldestResult>(
      "SELECT MIN(recorded_at) as oldest FROM server_metrics"
    );

    // Get app_metrics stats
    const [appMetricsTotal] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM app_metrics"
    );
    const [appMetricsOldCount] = await query<CountResult>(
      "SELECT COUNT(*) as count FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const [appMetricsOldest] = await query<OldestResult>(
      "SELECT MIN(recorded_at) as oldest FROM app_metrics"
    );

    return NextResponse.json({
      data: {
        logs: {
          total: logsTotal?.count || 0,
          olderThan7Days: logsOldCount?.count || 0,
          oldestRecord: logsOldest?.oldest || null,
          retentionDays: 7,
        },
        serverMetrics: {
          total: serverMetricsTotal?.count || 0,
          olderThan30Days: serverMetricsOldCount?.count || 0,
          oldestRecord: serverMetricsOldest?.oldest || null,
          retentionDays: 30,
        },
        appMetrics: {
          total: appMetricsTotal?.count || 0,
          olderThan30Days: appMetricsOldCount?.count || 0,
          oldestRecord: appMetricsOldest?.oldest || null,
          retentionDays: 30,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching retention stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch retention stats" },
      { status: 500 }
    );
  }
}

// POST /api/settings/retention - Trigger manual cleanup
export async function POST() {
  try {
    // Delete logs older than 7 days
    const logsResult = await execute(
      "DELETE FROM app_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const logsDeleted = logsResult.affectedRows;

    // Delete server_metrics older than 30 days
    const serverMetricsResult = await execute(
      "DELETE FROM server_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const serverMetricsDeleted = serverMetricsResult.affectedRows;

    // Delete app_metrics older than 30 days
    const appMetricsResult = await execute(
      "DELETE FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const appMetricsDeleted = appMetricsResult.affectedRows;

    const totalDeleted = logsDeleted + serverMetricsDeleted + appMetricsDeleted;

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Deleted ${totalDeleted} records.`,
      details: {
        logsDeleted,
        serverMetricsDeleted,
        appMetricsDeleted,
        totalDeleted,
      },
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Failed to perform cleanup" },
      { status: 500 }
    );
  }
}
