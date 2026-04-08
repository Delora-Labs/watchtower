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
    
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (canViewAllApps(user.role)) {
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
        LEFT JOIN health_check_results r ON r.id = (
          SELECT r2.id FROM health_check_results r2
          WHERE r2.health_check_id = hc.id
          ORDER BY r2.checked_at DESC LIMIT 1
        )
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
          LEFT JOIN health_check_results r ON r.id = (
            SELECT r2.id FROM health_check_results r2
            WHERE r2.health_check_id = hc.id
            ORDER BY r2.checked_at DESC LIMIT 1
          )
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
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, url, method, expected_status, timeout_ms, interval_ms, headers, enabled } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: "url must use http or https protocol" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "url must be a valid URL" },
        { status: 400 }
      );
    }

    // Validate timeout_ms (1 - 60000)
    if (timeout_ms !== undefined) {
      const t = Number(timeout_ms);
      if (!Number.isInteger(t) || t < 1 || t > 60000) {
        return NextResponse.json(
          { error: "timeout_ms must be an integer between 1 and 60000" },
          { status: 400 }
        );
      }
    }

    // Validate interval_ms (10000 - 86400000)
    if (interval_ms !== undefined) {
      const i = Number(interval_ms);
      if (!Number.isInteger(i) || i < 10000 || i > 86400000) {
        return NextResponse.json(
          { error: "interval_ms must be an integer between 10000 and 86400000" },
          { status: 400 }
        );
      }
    }

    // Validate expected_status (100 - 599)
    if (expected_status !== undefined) {
      const s = Number(expected_status);
      if (!Number.isInteger(s) || s < 100 || s > 599) {
        return NextResponse.json(
          { error: "expected_status must be an integer between 100 and 599" },
          { status: 400 }
        );
      }
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
