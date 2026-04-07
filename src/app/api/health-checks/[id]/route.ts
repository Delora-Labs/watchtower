import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: "GET" | "HEAD" | "POST";
  expected_status: number;
  timeout_ms: number;
  interval_sec: number;
  enabled: boolean;
  notify_on_down: boolean;
  team_id: string | null;
  created_at: Date;
}

// GET single health check
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const healthCheck = await queryOne<HealthCheck>(
      `SELECT hc.*, t.name as team_name
       FROM health_checks hc
       LEFT JOIN teams t ON hc.team_id = t.id
       WHERE hc.id = ?`,
      [id]
    );

    if (!healthCheck) {
      return NextResponse.json(
        { error: "Health check not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: healthCheck });
  } catch (error) {
    console.error("Get health check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH update health check
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      url,
      method,
      expected_status,
      timeout_ms,
      interval_ms,
      enabled,
      notify_on_down,
      team_id,
    } = body;

    const healthCheck = await queryOne<HealthCheck>(
      "SELECT * FROM health_checks WHERE id = ?",
      [id]
    );

    if (!healthCheck) {
      return NextResponse.json(
        { error: "Health check not found" },
        { status: 404 }
      );
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }

    // Validate method if provided
    if (method && !["GET", "HEAD", "POST"].includes(method)) {
      return NextResponse.json(
        { error: "Method must be GET, HEAD, or POST" },
        { status: 400 }
      );
    }

    await execute(
      `UPDATE health_checks SET 
        name = COALESCE(?, name),
        url = COALESCE(?, url),
        method = COALESCE(?, method),
        expected_status = COALESCE(?, expected_status),
        timeout_ms = COALESCE(?, timeout_ms),
        interval_ms = COALESCE(?, interval_ms),
        enabled = COALESCE(?, enabled),
        notify_on_down = COALESCE(?, notify_on_down),
        team_id = ?
       WHERE id = ?`,
      [
        name || null,
        url || null,
        method || null,
        expected_status ?? null,
        timeout_ms ?? null,
        interval_ms ?? null,
        enabled !== undefined ? (enabled ? 1 : 0) : null,
        notify_on_down ?? null,
        team_id !== undefined ? team_id : healthCheck.team_id,
        id,
      ]
    );

    const updated = await queryOne<HealthCheck>(
      `SELECT hc.*, t.name as team_name
       FROM health_checks hc
       LEFT JOIN teams t ON hc.team_id = t.id
       WHERE hc.id = ?`,
      [id]
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update health check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE health check
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Results will be cascade deleted
    const result = await execute("DELETE FROM health_checks WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Health check not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete health check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
