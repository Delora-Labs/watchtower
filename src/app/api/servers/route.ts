import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId, generateApiKey } from "@/lib/utils";
import { getUserFromSession, canViewAllApps, getUserTeamIds } from "@/lib/auth";

// GET all servers with their apps (filtered by user role/team)
export async function GET() {
  try {
    const user = await getUserFromSession();
    
    const servers = await query<{
      id: string;
      name: string;
      hostname: string;
      os: string;
      ip_address: string;
      last_heartbeat: Date;
      is_online: boolean;
      run_health_check: boolean;
    }>("SELECT * FROM servers ORDER BY name");

    interface AppRow {
      id: string;
      server_id: string;
      pm2_id: number;
      pm2_name: string;
      display_name: string;
      url: string;
      category: string;
      status: string;
      cpu_percent: number;
      memory_mb: number;
      avg_cpu_5min: number;
      avg_memory_5min: number;
      uptime_ms: number;
      restarts: number;
      last_seen: Date;
      notifications_enabled: boolean;
      team_id: string | null;
    }
    
    let apps: AppRow[];
    
    if (!user || canViewAllApps(user.role)) {
      // System admin or unauthenticated (agent API) sees all apps with 5-min averages
      apps = await query<AppRow>(`
        SELECT 
          a.*, 
          aa.team_id,
          COALESCE(AVG(m.cpu_percent), a.cpu_percent) as avg_cpu_5min,
          COALESCE(AVG(m.memory_mb), a.memory_mb) as avg_memory_5min
        FROM apps a 
        LEFT JOIN app_assignments aa ON a.id = aa.app_id 
        LEFT JOIN app_metrics m ON m.app_id = a.id 
          AND m.recorded_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        GROUP BY a.id, aa.team_id
        ORDER BY a.pm2_name
      `);
    } else {
      // Team lead or user: only see apps assigned to their teams
      const teamIds = await getUserTeamIds(user.id);
      if (teamIds.length === 0) {
        apps = [];
      } else {
        const placeholders = teamIds.map(() => "?").join(",");
        apps = await query<AppRow>(
          `SELECT 
            a.*, 
            aa.team_id,
            COALESCE(AVG(m.cpu_percent), a.cpu_percent) as avg_cpu_5min,
            COALESCE(AVG(m.memory_mb), a.memory_mb) as avg_memory_5min
          FROM apps a 
          JOIN app_assignments aa ON a.id = aa.app_id 
          LEFT JOIN app_metrics m ON m.app_id = a.id 
            AND m.recorded_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
          WHERE aa.team_id IN (${placeholders})
          GROUP BY a.id, aa.team_id
          ORDER BY a.pm2_name`,
          teamIds
        );
      }
    }

    // Group apps by server
    const serverMap = new Map(
      servers.map((s) => [
        s.id,
        {
          ...s,
          apps: [] as AppRow[],
        },
      ])
    );

    for (const app of apps) {
      serverMap.get(app.server_id)?.apps.push(app);
    }

    // Filter out servers with no visible apps (for non-admins)
    let result = Array.from(serverMap.values());
    if (user && !canViewAllApps(user.role)) {
      result = result.filter(s => s.apps.length > 0);
    }

    return NextResponse.json({
      data: result,
      user: user ? { id: user.id, role: user.role } : null,
    });
  } catch (error) {
    console.error("Get servers error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST create new server (team_lead+ only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only system_admin and team_lead can add servers
    if (user.role !== "system_admin" && user.role !== "team_lead") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get the user's team (for auto-assigning apps)
    const teamIds = await getUserTeamIds(user.id);
    const defaultTeamId = teamIds.length > 0 ? teamIds[0] : null;

    const id = generateId();
    const apiKey = generateApiKey();

    await execute(
      "INSERT INTO servers (id, name, api_key, default_team_id) VALUES (?, ?, ?, ?)",
      [id, name, apiKey, defaultTeamId]
    );

    return NextResponse.json({
      data: { id, name, apiKey },
    });
  } catch (error) {
    console.error("Create server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
