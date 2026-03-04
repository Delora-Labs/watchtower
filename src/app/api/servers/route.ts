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
      uptime_ms: number;
      restarts: number;
      last_seen: Date;
      notifications_enabled: boolean;
      team_id: string | null;
    }
    
    let apps: AppRow[];
    
    if (!user || canViewAllApps(user.role)) {
      // System admin or unauthenticated (agent API) sees all apps
      apps = await query<AppRow>("SELECT a.*, aa.team_id FROM apps a LEFT JOIN app_assignments aa ON a.id = aa.app_id ORDER BY a.pm2_name");
    } else {
      // Team lead or user: only see apps assigned to their teams
      const teamIds = await getUserTeamIds(user.id);
      if (teamIds.length === 0) {
        apps = [];
      } else {
        const placeholders = teamIds.map(() => "?").join(",");
        apps = await query<AppRow>(
          `SELECT a.*, aa.team_id FROM apps a 
           JOIN app_assignments aa ON a.id = aa.app_id 
           WHERE aa.team_id IN (${placeholders})
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

// POST create new server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = generateId();
    const apiKey = generateApiKey();

    await execute(
      "INSERT INTO servers (id, name, api_key) VALUES (?, ?, ?)",
      [id, name, apiKey]
    );

    return NextResponse.json({
      data: { id, name, apiKey },
    });
  } catch (error) {
    console.error("Create server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
