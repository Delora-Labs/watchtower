import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { generateId } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

// POST restart an app on a server
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: serverId } = await params;
    const body = await request.json();
    const { appName } = body;

    if (!appName) {
      return NextResponse.json({ error: "appName is required" }, { status: 400 });
    }

    // Verify server exists
    const server = await queryOne<{ id: string }>(
      "SELECT id FROM servers WHERE id = ?",
      [serverId]
    );

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Create restart command
    const commandId = generateId();
    await execute(
      "INSERT INTO commands (id, server_id, app_name, action) VALUES (?, ?, ?, 'restart')",
      [commandId, serverId, appName]
    );

    return NextResponse.json({
      data: { commandId, message: "Restart command queued" },
    });
  } catch (error) {
    console.error("Restart error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
