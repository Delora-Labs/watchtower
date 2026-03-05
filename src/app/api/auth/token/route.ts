import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";

// GET - check if user has a token set (returns masked version)
export async function GET() {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await queryOne<{ github_token: string | null }>(
      "SELECT github_token FROM users WHERE id = ?",
      [user.id]
    );

    if (!result?.github_token) {
      return NextResponse.json({ hasToken: false, maskedToken: null });
    }

    // Mask the token: show first 4 and last 4 chars
    const token = result.github_token;
    const masked = token.length > 12 
      ? `${token.slice(0, 7)}...${token.slice(-4)}`
      : "****";

    return NextResponse.json({ hasToken: true, maskedToken: masked });
  } catch (error) {
    console.error("Get token error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - update user's GitHub token
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { github_token } = body;

    // Allow clearing the token
    await execute(
      "UPDATE users SET github_token = ? WHERE id = ?",
      [github_token || null, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update token error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
