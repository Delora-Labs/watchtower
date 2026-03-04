import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
}

// Agent reports command completion
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const server = await queryOne<{ id: string }>(
      "SELECT s.id FROM servers s JOIN commands c ON c.server_id = s.id WHERE s.api_key = ? AND c.id = ?",
      [apiKey, id]
    );

    if (!server) {
      return NextResponse.json({ error: "Invalid" }, { status: 401 });
    }

    const body = await request.json();
    
    await execute(
      "UPDATE commands SET status = ?, result = ?, executed_at = NOW() WHERE id = ?",
      [body.success ? "completed" : "failed", body.result || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Command update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
