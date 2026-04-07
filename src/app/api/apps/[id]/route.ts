import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne, query } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";

interface App {
  id: string;
  server_id: string;
  pm2_name: string;
  display_name: string | null;
  url: string | null;
  category: string | null;
  notifications_enabled: boolean;
}

interface AppAssignment {
  app_id: string;
  team_id: string | null;
  user_id: string | null;
  notify_on_down: boolean;
  notify_on_restart: boolean;
}

// GET single app with assignment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    const app = await queryOne<App>(
      "SELECT * FROM apps WHERE id = ?",
      [id]
    );

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const assignment = await queryOne<AppAssignment>(
      "SELECT * FROM app_assignments WHERE app_id = ?",
      [id]
    );

    return NextResponse.json({ 
      data: {
        ...app,
        assignment
      }
    });
  } catch (error) {
    console.error("Get app error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH update app settings and team assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Only system_admin and team_lead can update apps
  if (user.role !== "system_admin" && user.role !== "team_lead") {
    return NextResponse.json({ error: "Only admins and team leads can update apps" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      display_name, 
      url, 
      category, 
      notifications_enabled,
      team_id,
      notify_on_down,
      notify_on_restart
    } = body;

    const app = await queryOne<App>(
      "SELECT * FROM apps WHERE id = ?",
      [id]
    );

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Update app details
    if (display_name !== undefined || url !== undefined || category !== undefined || notifications_enabled !== undefined) {
      await execute(
        `UPDATE apps SET 
          display_name = COALESCE(?, display_name),
          url = COALESCE(?, url),
          category = COALESCE(?, category),
          notifications_enabled = COALESCE(?, notifications_enabled)
         WHERE id = ?`,
        [display_name, url, category, notifications_enabled, id]
      );
    }

    // Handle team assignment
    if (team_id !== undefined) {
      // Check if assignment exists
      const existing = await query<AppAssignment>(
        "SELECT * FROM app_assignments WHERE app_id = ?",
        [id]
      );

      if (team_id === null) {
        // Remove assignment
        await execute("DELETE FROM app_assignments WHERE app_id = ?", [id]);
      } else if (existing.length > 0) {
        // Update existing
        await execute(
          `UPDATE app_assignments SET 
            team_id = ?,
            notify_on_down = COALESCE(?, notify_on_down),
            notify_on_restart = COALESCE(?, notify_on_restart)
           WHERE app_id = ?`,
          [team_id, notify_on_down, notify_on_restart, id]
        );
      } else {
        // Create new
        await execute(
          `INSERT INTO app_assignments (app_id, team_id, notify_on_down, notify_on_restart) 
           VALUES (?, ?, ?, ?)`,
          [id, team_id, notify_on_down ?? true, notify_on_restart ?? false]
        );
      }
    }

    // Get updated app with assignment
    const updated = await queryOne<App>(
      "SELECT * FROM apps WHERE id = ?",
      [id]
    );

    const assignment = await queryOne<AppAssignment>(
      "SELECT * FROM app_assignments WHERE app_id = ?",
      [id]
    );

    return NextResponse.json({ 
      data: {
        ...updated,
        assignment
      }
    });
  } catch (error) {
    console.error("Update app error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE app (team_lead+ only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (user.role !== "system_admin" && user.role !== "team_lead") {
      return NextResponse.json({ error: "Only admins and team leads can delete apps" }, { status: 403 });
    }

    const { id } = await params;
    
    // Delete related records first
    await execute("DELETE FROM app_assignments WHERE app_id = ?", [id]);
    await execute("DELETE FROM app_metrics WHERE app_id = ?", [id]);
    
    // Delete the app
    const result = await execute("DELETE FROM apps WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "App deleted" });
  } catch (error) {
    console.error("Delete app error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
