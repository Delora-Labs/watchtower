import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";

// POST /api/servers/register - Register a new server (called by install script)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, hostname, ip } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Server name is required" },
        { status: 400 }
      );
    }

    // Check if server already exists by hostname
    const existing = await query<{ id: string }>(
      "SELECT id FROM servers WHERE hostname = ?",
      [hostname]
    );

    if (existing.length > 0) {
      // Return existing server ID
      return NextResponse.json({
        data: { id: existing[0].id, existing: true },
      });
    }

    // Create new server
    const id = generateId();
    const apiKey = `wt_${generateId().replace(/-/g, "")}`;

    await execute(
      `INSERT INTO servers (id, name, hostname, ip_address, api_key, status) 
       VALUES (?, ?, ?, ?, ?, 'offline')`,
      [id, name, hostname || null, ip || null, apiKey]
    );

    return NextResponse.json({
      data: { id, apiKey, name },
    });
  } catch (error) {
    console.error("Register server error:", error);
    return NextResponse.json(
      { error: "Failed to register server" },
      { status: 500 }
    );
  }
}
