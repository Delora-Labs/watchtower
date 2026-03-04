import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { generateId } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

// POST /api/servers/[id]/logs - Request logs for an app
export async function POST(request: NextRequest, { params }: Props) {
  const { id: serverId } = await params;
  const body = await request.json();
  const { appName } = body;

  if (!appName) {
    return NextResponse.json({ error: "appName required" }, { status: 400 });
  }

  // Verify server exists
  const server = await queryOne<{ id: string }>(
    "SELECT id FROM servers WHERE id = ?",
    [serverId]
  );

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Create logs command
  const commandId = generateId();
  await execute(
    `INSERT INTO commands (id, server_id, app_name, action, status)
     VALUES (?, ?, ?, 'logs', 'pending')`,
    [commandId, serverId, appName]
  );

  return NextResponse.json({ 
    pending: true, 
    commandId,
    message: "Logs request queued, poll for result" 
  });
}
