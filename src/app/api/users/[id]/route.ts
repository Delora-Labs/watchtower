import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { getUserFromSession, canManageUsers } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member" | "viewer";
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUserFromSession();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Users can view their own profile, admins can view any
    if (id !== currentUser.id && !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const user = await queryOne<User>(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUserFromSession();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: "Only system admins can update users" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, is_active, teamId } = body;

    // Validate role if provided
    const validRoles = ["admin", "member", "viewer"];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const user = await queryOne<User>(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await execute(
      `UPDATE users SET 
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, role, is_active, id]
    );

    // Update team membership if teamId is provided (even if empty string to remove)
    if (teamId !== undefined) {
      // Remove all existing team memberships
      await execute("DELETE FROM team_members WHERE user_id = ?", [id]);
      
      // Add new team membership if teamId is not empty
      if (teamId) {
        const teamRole = role === "team_lead" ? "lead" : "member";
        await execute(
          "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)",
          [teamId, id, teamRole]
        );
      }
    }

    const updated = await queryOne<User>(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUserFromSession();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: "Only system admins can delete users" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Delete team memberships
    await execute("DELETE FROM team_members WHERE user_id = ?", [id]);
    
    // Delete app assignments for this user
    await execute("DELETE FROM app_assignments WHERE user_id = ?", [id]);
    
    // Delete user
    const result = await execute("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
