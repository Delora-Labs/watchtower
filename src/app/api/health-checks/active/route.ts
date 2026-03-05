import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

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
// Only returns checks if the requesting server has run_health_checks = TRUE
export async function GET(request: NextRequest) {
  try {
    // Check which server is requesting via API key
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (apiKey) {
      // Verify this server should run health checks
      const server = await queryOne<{ run_health_check: boolean }>(
        "SELECT run_health_check FROM servers WHERE api_key = ?",
        [apiKey]
      );
      
      if (!server || !server.run_health_check) {
        // This server shouldn't run health checks - return empty array
        return NextResponse.json({ data: [] });
      }
    }

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
