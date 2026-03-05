import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession, getUserTeamIds } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeTeams = searchParams.get("includeTeams") === "true";

    let teamIds: string[] = [];
    if (includeTeams) {
      teamIds = await getUserTeamIds(user.id);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      teamIds,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
