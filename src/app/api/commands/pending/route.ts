import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface Command {
  id: string;
  app_name: string;
  action: string;
}

// GET /api/commands/pending - Agent polls for pending commands
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  // Find server by API key
  const servers = await query<{ id: string }>(
    "SELECT id FROM servers WHERE api_key = ?",
    [apiKey]
  );

  if (servers.length === 0) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const serverId = servers[0].id;

  // Get pending commands
  const commands = await query<Command>(
    `SELECT id, app_name, action 
     FROM commands 
     WHERE server_id = ? AND status = 'pending'
     ORDER BY created_at ASC`,
    [serverId]
  );

  // Mark as sent
  if (commands.length > 0) {
    const ids = commands.map(c => c.id);
    await query(
      `UPDATE commands SET status = 'sent' WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
  }

  return NextResponse.json(commands);
}
