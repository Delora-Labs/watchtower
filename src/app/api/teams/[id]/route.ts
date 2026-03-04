import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";

interface Team {
  id: string;
  name: string;
  description: string | null;
  teams_webhook_url: string | null;
  created_at: Date;
  updated_at: Date;
}

// GET single team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const team = await queryOne<Team>(
      "SELECT * FROM teams WHERE id = ?",
      [id]
    );

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH update team
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, teams_webhook_url, description } = body;

    const team = await queryOne<Team>(
      "SELECT * FROM teams WHERE id = ?",
      [id]
    );

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await execute(
      `UPDATE teams SET 
        name = COALESCE(?, name),
        teams_webhook_url = ?,
        description = COALESCE(?, description)
       WHERE id = ?`,
      [name || null, teams_webhook_url, description || null, id]
    );

    const updated = await queryOne<Team>(
      "SELECT * FROM teams WHERE id = ?",
      [id]
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete team members first
    await execute("DELETE FROM team_members WHERE team_id = ?", [id]);
    
    // Delete app assignments for this team
    await execute("DELETE FROM app_assignments WHERE team_id = ?", [id]);
    
    // Delete team
    const result = await execute("DELETE FROM teams WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
