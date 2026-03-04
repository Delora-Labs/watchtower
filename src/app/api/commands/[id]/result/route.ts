import { NextRequest, NextResponse } from "next/server";
import { execute, query, queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
}

// POST /api/commands/[id]/result - Agent reports command result
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const apiKey = request.headers.get("x-api-key");
  
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const body = await request.json();
  const { status, result } = body;

  // Verify API key and command ownership
  const command = await queryOne<{ server_id: string; id: string }>(
    `SELECT c.id, c.server_id 
     FROM commands c
     JOIN servers s ON s.id = c.server_id
     WHERE c.id = ? AND s.api_key = ?`,
    [id, apiKey]
  );

  if (!command) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  // Update command
  await execute(
    `UPDATE commands 
     SET status = ?, result = ?, executed_at = NOW()
     WHERE id = ?`,
    [status === "success" ? "completed" : "failed", result, id]
  );

  return NextResponse.json({ success: true });
}
