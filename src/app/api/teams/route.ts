import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";

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
