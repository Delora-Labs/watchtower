import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";

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
  try {
    const { id } = await params;
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
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, is_active } = body;

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
