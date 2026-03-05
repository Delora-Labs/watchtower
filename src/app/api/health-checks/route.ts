import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { getUserFromSession, canViewAllApps, getUserTeamIds } from "@/lib/auth";

interface HealthCheckRow {
  id: string;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  timeout_ms: number;
  interval_ms: number;
  enabled: boolean;
  notify_on_down: boolean;
  team_id: string | null;
  headers: string | null;
  latest_status: string | null;
  latest_response_time_ms: number | null;
  latest_checked_at: string | null;
}

// GET /api/health-checks - Returns all health checks with latest status (filtered by team)
export async function GET() {
  try {
    const user = await getUserFromSession();
    
    let checks: HealthCheckRow[];
    
    if (!user || canViewAllApps(user.role)) {
      // System admin sees all health checks
      checks = await query<HealthCheckRow>(`
        SELECT 
          hc.id,
          hc.name,
          hc.url,
          hc.method,
          hc.expected_status,
          hc.timeout_ms,
          hc.interval_ms,
          hc.enabled,
          hc.notify_on_down,
          hc.team_id,
          hc.headers,
          r.status as latest_status,
          r.response_time_ms as latest_response_time_ms,
          r.checked_at as latest_checked_at
        FROM health_checks hc
        LEFT JOIN (
          SELECT health_check_id, status, response_time_ms, checked_at
          FROM health_check_results r1
          WHERE checked_at = (
            SELECT MAX(checked_at) 
            FROM health_check_results r2 
            WHERE r2.health_check_id = r1.health_check_id
          )
        ) r ON r.health_check_id = hc.id
        ORDER BY 
          CASE WHEN r.status = 'down' THEN 0 ELSE 1 END,
          hc.name
      `);
    } else {
      // Non-admin users only see health checks assigned to their teams
      const teamIds = await getUserTeamIds(user.id);
      if (teamIds.length === 0) {
        checks = [];
      } else {
        const placeholders = teamIds.map(() => "?").join(",");
        checks = await query<HealthCheckRow>(`
          SELECT 
            hc.id,
            hc.name,
            hc.url,
            hc.method,
            hc.expected_status,
            hc.timeout_ms,
            hc.interval_ms,
            hc.enabled,
            hc.notify_on_down,
            hc.team_id,
            hc.headers,
            r.status as latest_status,
            r.response_time_ms as latest_response_time_ms,
            r.checked_at as latest_checked_at
          FROM health_checks hc
          LEFT JOIN (
            SELECT health_check_id, status, response_time_ms, checked_at
            FROM health_check_results r1
            WHERE checked_at = (
              SELECT MAX(checked_at) 
              FROM health_check_results r2 
              WHERE r2.health_check_id = r1.health_check_id
            )
          ) r ON r.health_check_id = hc.id
          WHERE hc.team_id IN (${placeholders})
          ORDER BY 
            CASE WHEN r.status = 'down' THEN 0 ELSE 1 END,
            hc.name
        `, teamIds);
      }
    }

    return NextResponse.json({ data: checks });
  } catch (error) {
    console.error("Error fetching health checks:", error);
    return NextResponse.json(
      { error: "Failed to fetch health checks" },
      { status: 500 }
    );
  }
}

// POST /api/health-checks - Create a new health check
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, method, expected_status, timeout_ms, interval_ms, headers, enabled } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 }
      );
    }

    const id = generateId();
    await execute(
      `INSERT INTO health_checks (id, name, url, method, expected_status, timeout_ms, interval_ms, headers, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        url,
        method || "GET",
        expected_status || 200,
        timeout_ms || 5000,
        interval_ms || 60000,
        headers ? JSON.stringify(headers) : null,
        enabled !== false ? 1 : 0,
      ]
    );

    return NextResponse.json({ data: { id }, success: true });
  } catch (error) {
    console.error("Error creating health check:", error);
    return NextResponse.json(
      { error: "Failed to create health check" },
      { status: 500 }
    );
  }
}
