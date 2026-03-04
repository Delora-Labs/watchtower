import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { generateId } from "@/lib/utils";
import crypto from "crypto";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "system_admin" | "team_lead" | "user";
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Simple password hashing (in production, use bcrypt)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// GET all users
export async function GET() {
  try {
    const users = await query<User>(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM users ORDER BY name, email"
    );

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST create/invite new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role = "user" } = body;

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
    // Generate a temporary password (in production, send invite email)
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const passwordHash = hashPassword(tempPassword);

    await execute(
      "INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
      [id, email, name || null, role, passwordHash]
    );

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
