import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { hashPassword, getUserFromSession, canViewAllApps, getUserTeamIds } from "@/lib/auth";
import crypto from "crypto";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "system_admin" | "team_lead" | "user";
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  team_ids?: string[];
}

// GET all users (filtered by team for non-admins)
export async function GET() {
  try {
    const currentUser = await getUserFromSession();
    
    // Get all users with their team memberships
    const users = await query<User & { team_id: string | null }>(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, u.updated_at,
              GROUP_CONCAT(tm.team_id) as team_ids
       FROM users u
       LEFT JOIN team_members tm ON u.id = tm.user_id
       GROUP BY u.id
       ORDER BY u.name, u.email`
    );

    // Transform team_ids from comma-separated string to array
    const usersWithTeams = users.map(u => ({
      ...u,
      team_ids: u.team_ids ? String(u.team_ids).split(",") : [],
    }));

    // Filter users by team for non-admins
    if (currentUser && !canViewAllApps(currentUser.role)) {
      const myTeamIds = await getUserTeamIds(currentUser.id);
      const filteredUsers = usersWithTeams.filter(u => 
        u.team_ids.some(tid => myTeamIds.includes(tid)) || u.id === currentUser.id
      );
      return NextResponse.json({ data: filteredUsers });
    }

    return NextResponse.json({ data: usersWithTeams });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST create/invite new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role = "user", teamId } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await query<User>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const id = generateId();
    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    await execute(
      "INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
      [id, email, name || null, role, passwordHash]
    );

    // Add user to team if teamId provided
    if (teamId) {
      const teamRole = role === "team_lead" ? "lead" : "member";
      await execute(
        "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)",
        [teamId, id, teamRole]
      );
    }

    const user = await query<User>(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    return NextResponse.json({ 
      data: user[0],
      tempPassword // Return temp password for admin to share (in production, email it)
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
