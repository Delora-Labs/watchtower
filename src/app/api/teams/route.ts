import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { getUserFromSession, canManageTeams } from "@/lib/auth";

interface Team {
  id: string;
  name: string;
  description: string | null;
  teams_webhook_url: string | null;
  created_at: Date;
  updated_at: Date;
}

// GET all teams
export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const teams = await query<Team>(
      "SELECT * FROM teams ORDER BY name"
    );

    return NextResponse.json({ data: teams });
  } catch (error) {
    console.error("Get teams error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST create new team
export async function POST(request: NextRequest) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageTeams(user.role)) {
    return NextResponse.json({ error: "Only system admins can create teams" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, teams_webhook_url } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = generateId();

    await execute(
      "INSERT INTO teams (id, name, teams_webhook_url) VALUES (?, ?, ?)",
      [id, name, teams_webhook_url || null]
    );

    const team = await query<Team>(
      "SELECT * FROM teams WHERE id = ?",
      [id]
    );

    return NextResponse.json({ data: team[0] });
  } catch (error) {
    console.error("Create team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
