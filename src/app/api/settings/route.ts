import { NextRequest, NextResponse } from "next/server";
import { query, execute, queryOne } from "@/lib/db";

interface Setting {
  key: string;
  value: string;
}

// GET /api/settings - Get all settings
export async function GET() {
  const settings = await query<Setting>("SELECT `key`, value FROM settings");
  
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  
  return NextResponse.json({ data: result });
}

// PUT /api/settings - Update settings
export async function PUT(request: NextRequest) {
  const body = await request.json();
  
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') continue;
    
    const existing = await queryOne<Setting>(
      "SELECT `key` FROM settings WHERE `key` = ?",
      [key]
    );
    
    if (existing) {
      await execute(
        "UPDATE settings SET value = ? WHERE `key` = ?",
        [value, key]
      );
    } else {
      await execute(
        "INSERT INTO settings (`key`, value) VALUES (?, ?)",
        [key, value]
      );
    }
  }
  
  return NextResponse.json({ success: true });
}
