import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId, generateApiKey } from "@/lib/utils";

// GET all servers with their apps
export async function GET() {
  try {
    const servers = await query<{
      id: string;
      name: string;
      hostname: string;
      os: string;
      ip_address: string;
      last_heartbeat: Date;
      is_online: boolean;
    }>("SELECT * FROM servers ORDER BY name");

    const apps = await query<{
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
    }>("SELECT * FROM apps ORDER BY pm2_name");

    // Group apps by server
    const serverMap = new Map(
      servers.map((s) => [
        s.id,
        {
          ...s,
          apps: [] as typeof apps,
        },
      ])
    );

    for (const app of apps) {
      serverMap.get(app.server_id)?.apps.push(app);
    }

    return NextResponse.json({
      data: Array.from(serverMap.values()),
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
