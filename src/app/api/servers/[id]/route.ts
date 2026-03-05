import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  
  // Only system_admin can delete servers
  if (user.role !== "system_admin") {
    return NextResponse.json({ error: "Only system admins can delete servers" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // First delete all related records (ignore errors for non-existent tables)
    
    // Delete app assignments for apps on this server
    try {
      await execute(`
        DELETE aa FROM app_assignments aa
        INNER JOIN apps a ON aa.app_id = a.id
        WHERE a.server_id = ?
      `, [id]);
    } catch (e) { /* table may not exist */ }
    
    // Delete app metrics for apps on this server
    try {
      await execute(`
        DELETE am FROM app_metrics am
        INNER JOIN apps a ON am.app_id = a.id
        WHERE a.server_id = ?
      `, [id]);
    } catch (e) { /* table may not exist */ }
    
    // Delete apps for this server
    await execute("DELETE FROM apps WHERE server_id = ?", [id]);
    
    // Delete command results for this server
    try {
      await execute("DELETE FROM command_results WHERE server_id = ?", [id]);
    } catch (e) { /* table may not exist */ }
    
    // Delete the server
    const result = await execute(
      "DELETE FROM servers WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Server deleted" });
  } catch (error) {
    console.error("Delete server error:", error);
    return NextResponse.json(
      { error: "Failed to delete server" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const servers = await query<any>(
      "SELECT * FROM servers WHERE id = ?",
      [id]
    );

    if (servers.length === 0) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    return NextResponse.json({ data: servers[0] });
  } catch (error) {
    console.error("Get server error:", error);
    return NextResponse.json(
      { error: "Failed to get server" },
      { status: 500 }
    );
  }
}

// PATCH update server (name, run_health_check)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  
  // Only system_admin and team_lead can edit servers
  if (user.role !== "system_admin" && user.role !== "team_lead") {
    return NextResponse.json({ error: "Only admins and team leads can edit servers" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, run_health_check } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    
    if (run_health_check !== undefined) {
      updates.push("run_health_check = ?");
      values.push(run_health_check ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);

    const result = await execute(
      `UPDATE servers SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Server updated" });
  } catch (error) {
    console.error("Update server error:", error);
    return NextResponse.json(
      { error: "Failed to update server" },
      { status: 500 }
    );
  }
}
