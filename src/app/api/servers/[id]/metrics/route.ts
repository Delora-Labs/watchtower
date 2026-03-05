import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface MetricRow {
  id: string;
  server_id: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_used_percent: number;
  recorded_at: Date;
}

// GET metrics for a server
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "1h";

    // Calculate time range
    let hours: number;
    switch (range) {
      case "6h":
        hours = 6;
        break;
      case "24h":
        hours = 24;
        break;
      case "7d":
        hours = 24 * 7;
        break;
      default:
        hours = 1;
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Consistent 1-minute aggregation for all ranges
    // More data = more points (longer ranges show more history)
    const intervalMinutes = 1;

    // Get aggregated metrics
    const metrics = await query<MetricRow>(
      `SELECT 
        MIN(id) as id,
        server_id,
        AVG(cpu_percent) as cpu_percent,
        AVG(memory_used_mb) as memory_used_mb,
        AVG(memory_total_mb) as memory_total_mb,
        AVG(disk_used_percent) as disk_used_percent,
        MIN(recorded_at) as recorded_at
      FROM server_metrics
      WHERE server_id = ? AND recorded_at >= ?
      GROUP BY server_id, FLOOR(UNIX_TIMESTAMP(recorded_at) / (? * 60))
      ORDER BY recorded_at ASC`,
      [id, since, intervalMinutes]
    );

    // Get current/latest values
    const latest = await query<MetricRow>(
      `SELECT * FROM server_metrics 
       WHERE server_id = ? 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [id]
    );

    // Get summary stats
    const statsRaw = await query<{
      avg_cpu: string | number;
      max_cpu: string | number;
      avg_memory: string | number;
      max_memory: string | number;
      avg_disk: string | number;
      max_disk: string | number;
    }>(
      `SELECT 
        AVG(cpu_percent) as avg_cpu,
        MAX(cpu_percent) as max_cpu,
        AVG(memory_used_mb) as avg_memory,
        MAX(memory_used_mb) as max_memory,
        AVG(disk_used_percent) as avg_disk,
        MAX(disk_used_percent) as max_disk
      FROM server_metrics
      WHERE server_id = ? AND recorded_at >= ?`,
      [id, since]
    );
    
    // Convert string values to numbers (MySQL returns decimals as strings)
    const stats = statsRaw.map(s => ({
      avg_cpu: parseFloat(String(s.avg_cpu)) || 0,
      max_cpu: parseFloat(String(s.max_cpu)) || 0,
      avg_memory: parseFloat(String(s.avg_memory)) || 0,
      max_memory: parseFloat(String(s.max_memory)) || 0,
      avg_disk: parseFloat(String(s.avg_disk)) || 0,
      max_disk: parseFloat(String(s.max_disk)) || 0,
    }));

    // Format data for charts
    const chartData = metrics.map((m) => ({
      time: new Date(m.recorded_at).toISOString(),
      cpu: Math.round(m.cpu_percent * 10) / 10,
      memoryUsed: Math.round(m.memory_used_mb),
      memoryTotal: Math.round(m.memory_total_mb),
      memoryPercent: m.memory_total_mb > 0 
        ? Math.round((m.memory_used_mb / m.memory_total_mb) * 1000) / 10 
        : 0,
      disk: Math.round(m.disk_used_percent * 10) / 10,
    }));

    return NextResponse.json({
      data: {
        metrics: chartData,
        current: latest[0] ? {
          cpu: Math.round(latest[0].cpu_percent * 10) / 10,
          memoryUsed: Math.round(latest[0].memory_used_mb),
          memoryTotal: Math.round(latest[0].memory_total_mb),
          memoryPercent: latest[0].memory_total_mb > 0 
            ? Math.round((latest[0].memory_used_mb / latest[0].memory_total_mb) * 1000) / 10 
            : 0,
          disk: Math.round(latest[0].disk_used_percent * 10) / 10,
          recordedAt: latest[0].recorded_at,
        } : null,
        summary: stats[0] || null,
        range,
        count: chartData.length,
      },
    });
  } catch (error) {
    console.error("Get metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
