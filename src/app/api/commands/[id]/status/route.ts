import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
}

interface Command {
  id: string;
  status: string;
  result: string | null;
  executed_at: string | null;
}

// GET /api/commands/[id]/status - Check command status
export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;

  const command = await queryOne<Command>(
    "SELECT id, status, result, executed_at FROM commands WHERE id = ?",
    [id]
  );

  if (!command) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: command.id,
    status: command.status,
    result: command.result,
    executed_at: command.executed_at,
  });
}
