import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  timeout_ms: number;
  interval_ms: number;
  headers: string | null;
}

// GET /api/health-checks/active - Returns all enabled health checks for the agent
export async function GET() {
  try {
    const checks = await query<HealthCheck>(
      `SELECT id, name, url, method, expected_status, timeout_ms, interval_ms, headers
       FROM health_checks
       WHERE enabled = TRUE
       ORDER BY name`
    );

    // Parse headers JSON if present
    const result = checks.map((check) => ({
      id: check.id,
      name: check.name,
      url: check.url,
      method: check.method,
      expected_status: check.expected_status,
      timeout_ms: check.timeout_ms,
      interval_ms: check.interval_ms,
      headers: check.headers ? JSON.parse(check.headers) : null,
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error fetching active health checks:", error);
    return NextResponse.json(
      { error: "Failed to fetch health checks" },
      { status: 500 }
    );
  }
}
