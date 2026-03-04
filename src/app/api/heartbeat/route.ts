import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";

interface AppReport {
  pm2_id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
}

interface HeartbeatPayload {
  hostname: string;
  os: string;
  ip?: string;
  system: {
    cpu: number;
    memoryUsed: number;
    memoryTotal: number;
    diskUsed: number;
  };
  apps: AppReport[];
}

interface Server {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const server = await queryOne<Server>(
      "SELECT id, name FROM servers WHERE api_key = ?",
      [apiKey]
    );

    if (!server) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body: HeartbeatPayload = await request.json();

    // Update server info
    await execute(
      `UPDATE servers SET 
        hostname = ?, os = ?, ip_address = ?, 
        last_heartbeat = NOW(), is_online = TRUE 
       WHERE id = ?`,
      [body.hostname, body.os, body.ip || null, server.id]
    );

    // Record metrics
    await execute(
      `INSERT INTO server_metrics (server_id, cpu_percent, memory_used_mb, memory_total_mb, disk_used_percent)
       VALUES (?, ?, ?, ?, ?)`,
      [server.id, body.system.cpu, body.system.memoryUsed, body.system.memoryTotal, body.system.diskUsed]
    );

    // Update apps
    for (const app of body.apps) {
      const existingApp = await queryOne<{ id: string }>(
        "SELECT id FROM apps WHERE server_id = ? AND pm2_name = ?",
        [server.id, app.name]
      );

      if (existingApp) {
        await execute(
          `UPDATE apps SET 
            pm2_id = ?, status = ?, cpu_percent = ?, memory_mb = ?,
            uptime_ms = ?, restarts = ?, last_seen = NOW()
           WHERE id = ?`,
          [app.pm2_id, app.status, app.cpu, app.memory, app.uptime, app.restarts, existingApp.id]
        );
      } else {
        await execute(
          `INSERT INTO apps (id, server_id, pm2_id, pm2_name, status, cpu_percent, memory_mb, uptime_ms, restarts, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [generateId(), server.id, app.pm2_id, app.name, app.status, app.cpu, app.memory, app.uptime, app.restarts]
        );
      }
    }

    // Mark apps not in this heartbeat as offline
    const appNames = body.apps.map(a => a.name);
    if (appNames.length > 0) {
      const placeholders = appNames.map(() => "?").join(",");
      await execute(
        `UPDATE apps SET status = 'stopped' 
         WHERE server_id = ? AND pm2_name NOT IN (${placeholders}) AND status = 'online'`,
        [server.id, ...appNames]
      );
    }

    // Check for pending commands
    const commands = await query<{ id: string; app_name: string; action: string }>(
      "SELECT id, app_name, action FROM commands WHERE server_id = ? AND status = 'pending'",
      [server.id]
    );

    return NextResponse.json({
      success: true,
      commands: commands.map(c => ({ id: c.id, app: c.app_name, action: c.action })),
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
