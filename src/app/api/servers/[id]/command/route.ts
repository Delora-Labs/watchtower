import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { generateId } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

const VALID_ACTIONS = ["start", "stop", "restart", "logs"];

// POST send a command to an app on a server
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: serverId } = await params;
    const body = await request.json();
    const { appName, action } = body;

    if (!appName) {
      return NextResponse.json({ error: "appName is required" }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify server exists
    const server = await queryOne<{ id: string }>(
      "SELECT id FROM servers WHERE id = ?",
      [serverId]
    );

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Create command
    const commandId = generateId();
    await execute(
      "INSERT INTO commands (id, server_id, app_name, action) VALUES (?, ?, ?, ?)",
      [commandId, serverId, appName, action]
    );

    return NextResponse.json({
      data: { commandId, message: `${action} command queued` },
    });
  } catch (error) {
    console.error("Command error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
