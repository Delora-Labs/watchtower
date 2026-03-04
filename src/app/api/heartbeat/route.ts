import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { processAlerts, checkServerOffline } from "@/lib/alerts";

interface AppReport {
  pm2_id: number;
  name: string;
  status: string;
  cpu_percent?: number;
  cpu?: number;
  memory_mb?: number;
  memory?: number;
  uptime_ms?: number;
  uptime?: number;
  restarts: number;
}

interface HeartbeatPayload {
  hostname: string;
  os: string;
  ip?: string;
  // Go agent format
  metrics?: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    disk_used_percent: number;
  };
  // Old format
  system?: {
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
    // Validate API key (support both Bearer token and X-API-Key)
    const authHeader = request.headers.get("authorization");
    const xApiKey = request.headers.get("x-api-key");
    
    let apiKey: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    } else if (xApiKey) {
      apiKey = xApiKey;
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }
    const server = await queryOne<Server>(
      "SELECT id, name FROM servers WHERE api_key = ?",
      [apiKey]
    );

    if (!server) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body: HeartbeatPayload = await request.json();

    // Normalize metrics from either format
    const metrics = body.metrics || body.system;
    const cpu = body.metrics?.cpu_percent ?? body.system?.cpu ?? 0;
    const memUsed = body.metrics?.memory_used_mb ?? body.system?.memoryUsed ?? 0;
    const memTotal = body.metrics?.memory_total_mb ?? body.system?.memoryTotal ?? 0;
    const diskUsed = body.metrics?.disk_used_percent ?? body.system?.diskUsed ?? 0;

    // Update server info
    await execute(
      `UPDATE servers SET 
        hostname = ?, os = ?, ip_address = ?, 
        last_heartbeat = NOW(), is_online = TRUE 
       WHERE id = ?`,
      [body.hostname, body.os, body.ip || null, server.id]
    );

    // Record metrics
    if (metrics) {
      await execute(
        `INSERT INTO server_metrics (server_id, cpu_percent, memory_used_mb, memory_total_mb, disk_used_percent)
         VALUES (?, ?, ?, ?, ?)`,
        [server.id, cpu, memUsed, memTotal, diskUsed]
      );
    }

    // Process alerts before updating (to detect status changes)
    await processAlerts(server.id, server.name, body.apps);

    // Update apps
    for (const app of body.apps) {
      // Normalize values from either format
      const cpuPct = app.cpu_percent ?? app.cpu ?? 0;
      const memMb = app.memory_mb ?? app.memory ?? 0;
      const uptimeMs = app.uptime_ms ?? app.uptime ?? 0;
      
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
          [app.pm2_id, app.status, cpuPct, memMb, uptimeMs, app.restarts, existingApp.id]
        );
        
        // Record app metrics for averaging
        await execute(
          `INSERT INTO app_metrics (app_id, cpu_percent, memory_mb) VALUES (?, ?, ?)`,
          [existingApp.id, cpuPct, memMb]
        );
      } else {
        const newAppId = generateId();
        await execute(
          `INSERT INTO apps (id, server_id, pm2_id, pm2_name, status, cpu_percent, memory_mb, uptime_ms, restarts, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [newAppId, server.id, app.pm2_id, app.name, app.status, cpuPct, memMb, uptimeMs, app.restarts]
        );
        
        // Record app metrics for averaging (for new app too)
        await execute(
          `INSERT INTO app_metrics (app_id, cpu_percent, memory_mb) VALUES (?, ?, ?)`,
          [newAppId, cpuPct, memMb]
        );
      }
    }
    
    // Cleanup old app metrics (older than 1 hour)
    await execute(`DELETE FROM app_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`);
    
    // Check for other servers that may be offline
    await checkServerOffline();

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
