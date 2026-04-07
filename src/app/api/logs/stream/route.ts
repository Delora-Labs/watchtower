import { NextRequest } from "next/server";
import { query } from "@/lib/db";

interface LogRow {
  id: number;
  server_id: string;
  app_id: string | null;
  app_name: string | null;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  server_name?: string;
}

// GET /api/logs/stream - SSE endpoint for real-time log streaming
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const server = searchParams.get("server");
  const app = searchParams.get("app");
  const level = searchParams.get("level");
  
  // Track the last log ID we've sent
  let lastLogId = 0;
  
  // Get initial last log ID
  try {
    const initialResult = await query<{ max_id: number }>(
      "SELECT COALESCE(MAX(id), 0) as max_id FROM app_logs"
    );
    lastLogId = initialResult[0]?.max_id || 0;
  } catch (error) {
    console.error("Failed to get initial log ID:", error);
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", lastLogId })}\n\n`)
      );

      // Maximum connection duration: 5 minutes. Client should reconnect after close.
      const MAX_CONNECTION_MS = 5 * 60 * 1000;
      const connectionTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "timeout", message: "Connection duration limit reached. Please reconnect." })}\n\n`)
          );
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }, MAX_CONNECTION_MS);

      // Poll for new logs every 500ms
      const pollInterval = setInterval(async () => {
        try {
          const conditions: string[] = ["l.id > ?"];
          const params: (string | number)[] = [lastLogId];
          
          if (server) {
            conditions.push("l.server_id = ?");
            params.push(server);
          }
          
          if (app) {
            conditions.push("(l.app_id = ? OR l.app_name = ?)");
            params.push(app, app);
          }
          
          if (level) {
            conditions.push("l.level = ?");
            params.push(level);
          }
          
          const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(" AND ")}` 
            : "";
          
          const sql = `
            SELECT 
              l.id, l.server_id, l.app_id, l.app_name, l.level, l.message, l.timestamp,
              s.name as server_name
            FROM app_logs l
            LEFT JOIN servers s ON l.server_id = s.id
            ${whereClause}
            ORDER BY l.id ASC
            LIMIT 100
          `;
          
          const rows = await query<LogRow>(sql, params);
          
          if (rows.length > 0) {
            // Update last log ID
            lastLogId = Math.max(...rows.map(r => r.id));
            
            // Send logs as SSE event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "logs", data: rows })}\n\n`)
            );
          } else {
            // Send heartbeat to keep connection alive
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`)
            );
          }
        } catch (error) {
          console.error("SSE poll error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Poll failed" })}\n\n`)
          );
        }
      }, 500);
      
      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        clearTimeout(connectionTimeout);
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
