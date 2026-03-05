import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

interface LogRow {
  id: number;
  app_name: string | null;
  level: string;
  message: string;
  timestamp: string;
  server_name: string;
}

// POST /api/logs/analyze - AI analysis of recent errors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timeRange = "1h", server, app } = body;

    // Calculate time range
    const hours = timeRange === "6h" ? 6 : timeRange === "24h" ? 24 : 1;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Build query conditions
    const conditions = ["timestamp >= ?", "(level = 'error' OR level = 'warn')"];
    const params: (string | Date)[] = [since];

    if (server) {
      conditions.push("server_id = ?");
      params.push(server);
    }
    if (app) {
      conditions.push("app_name = ?");
      params.push(app);
    }

    // Get recent errors/warnings
    const logs = await query<LogRow>(
      `SELECT l.id, l.app_name, l.level, l.message, l.timestamp, s.name as server_name
       FROM app_logs l
       LEFT JOIN servers s ON l.server_id = s.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY l.timestamp DESC
       LIMIT 50`,
      params
    );

    if (logs.length === 0) {
      return NextResponse.json({
        data: {
          summary: "No errors or warnings found in the selected time range.",
          issues: [],
          recommendations: [],
        },
      });
    }

    // Format logs for AI analysis
    const logsText = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.server_name}:${l.app_name || "system"}] ${l.message}`
      )
      .join("\n");

    // Call Claude for analysis
    const client = new Anthropic();
    
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze these server logs and provide a concise summary. Focus on:
1. Main issues/patterns you see
2. Potential root causes
3. Recommended actions

Keep the response brief and actionable. Format as JSON with this structure:
{
  "summary": "Brief 1-2 sentence overview",
  "issues": [
    {"title": "Issue name", "severity": "high|medium|low", "count": number, "description": "Brief description"}
  ],
  "recommendations": ["Action 1", "Action 2"]
}

Logs:
${logsText}`,
        },
      ],
    });

    // Parse AI response
    const aiText = response.content[0].type === "text" ? response.content[0].text : "";
    
    // Try to extract JSON from response
    let analysis;
    try {
      // Find JSON in response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = {
          summary: aiText,
          issues: [],
          recommendations: [],
        };
      }
    } catch {
      analysis = {
        summary: aiText,
        issues: [],
        recommendations: [],
      };
    }

    return NextResponse.json({
      data: {
        ...analysis,
        logsAnalyzed: logs.length,
        timeRange,
      },
    });
  } catch (error) {
    console.error("Failed to analyze logs:", error);
    return NextResponse.json(
      { error: "Failed to analyze logs" },
      { status: 500 }
    );
  }
}
