import { query, execute, queryOne } from "./db";
// Note: `query` is used for batch-fetching apps to avoid N+1 queries
import { generateId } from "./utils";

interface App {
  id: string;
  pm2_name: string;
  display_name: string | null;
  url: string | null;
  status: string;
  server_id: string;
}

interface Team {
  id: string;
  name: string;
  teams_webhook_url: string | null;
}

// Check for status changes and send alerts
export async function processAlerts(
  serverId: string,
  serverName: string,
  apps: Array<{ name: string; status: string; pm2_id: number }>
) {
  // Fetch all apps for this server in a single query to avoid N+1
  const appNames = apps.map((a) => a.name);
  if (appNames.length === 0) return;

  const placeholders = appNames.map(() => "?").join(",");
  const dbApps = await query<App>(
    `SELECT a.id, a.pm2_name, a.display_name, a.url, a.status, a.server_id
     FROM apps a
     WHERE a.server_id = ? AND a.pm2_name IN (${placeholders})`,
    [serverId, ...appNames]
  );

  const dbAppsByName = new Map(dbApps.map((a) => [a.pm2_name, a]));

  for (const app of apps) {
    const dbApp = dbAppsByName.get(app.name);

    if (!dbApp) continue;

    const oldStatus = dbApp.status;
    const newStatus = app.status;

    // Status changed to error/stopped
    if (
      oldStatus === "online" &&
      (newStatus === "errored" || newStatus === "stopped")
    ) {
      await createAlert(
        serverId,
        dbApp.id,
        "app_down",
        `🔴 App **${dbApp.display_name || dbApp.pm2_name}** is ${newStatus} on ${serverName}`,
        "critical"
      );

      // Send Teams alert
      await sendTeamsAlertForApp(dbApp, serverName, newStatus);
    }

    // Status recovered
    if (
      (oldStatus === "errored" || oldStatus === "stopped") &&
      newStatus === "online"
    ) {
      await createAlert(
        serverId,
        dbApp.id,
        "app_recovered",
        `🟢 App **${dbApp.display_name || dbApp.pm2_name}** is back online on ${serverName}`,
        "info"
      );

      // Resolve previous alerts
      await execute(
        `UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW()
         WHERE app_id = ? AND is_resolved = FALSE`,
        [dbApp.id]
      );
    }
  }
}

async function createAlert(
  serverId: string,
  appId: string | null,
  type: string,
  message: string,
  severity: string
) {
  const id = generateId();
  await execute(
    `INSERT INTO alerts (id, server_id, app_id, type, message, severity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, serverId, appId, type, message, severity]
  );
  return id;
}

async function sendTeamsAlertForApp(
  app: App,
  serverName: string,
  status: string
) {
  // Get team with webhook for this app
  const assignment = await queryOne<{ team_id: string }>(
    `SELECT team_id FROM app_assignments WHERE app_id = ? AND notify_on_down = TRUE`,
    [app.id]
  );

  if (!assignment?.team_id) {
    // Check default webhook
    const setting = await queryOne<{ value: string }>(
      `SELECT value FROM settings WHERE \`key\` = 'default_teams_webhook'`
    );
    if (setting?.value) {
      await sendTeamsWebhook(setting.value, app, serverName, status);
    }
    return;
  }

  const team = await queryOne<Team>(
    `SELECT id, name, teams_webhook_url FROM teams WHERE id = ?`,
    [assignment.team_id]
  );

  if (team?.teams_webhook_url) {
    await sendTeamsWebhook(team.teams_webhook_url, app, serverName, status);
  }
}

async function sendTeamsWebhook(
  webhookUrl: string,
  app: App,
  serverName: string,
  status: string
) {
  const appName = app.display_name || app.pm2_name;
  const statusEmoji = status === "online" ? "🟢" : "🔴";
  const color = status === "online" ? "00FF00" : "FF0000";

  // Teams Adaptive Card format
  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `${statusEmoji} ${appName} is ${status}`,
              color: status === "online" ? "Good" : "Attention",
            },
            {
              type: "FactSet",
              facts: [
                { title: "Server", value: serverName },
                { title: "App", value: appName },
                { title: "Status", value: status },
                { title: "Time", value: new Date().toISOString() },
              ],
            },
          ],
          msteams: { width: "Full" },
        },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!res.ok) {
      console.error(`Teams webhook failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Teams webhook error:", err);
  }
}

// Check if server is offline (no heartbeat in 60s)
export async function checkServerOffline() {
  const offlineServers = await query<{ id: string; name: string }>(
    `SELECT id, name FROM servers
     WHERE is_online = TRUE
     AND last_heartbeat < DATE_SUB(NOW(), INTERVAL 60 SECOND)`
  );

  for (const server of offlineServers) {
    await execute(`UPDATE servers SET is_online = FALSE WHERE id = ?`, [
      server.id,
    ]);

    await createAlert(
      server.id,
      null,
      "server_offline",
      `⚠️ Server **${server.name}** is not responding`,
      "critical"
    );

    // Send Teams alert for server down
    const setting = await queryOne<{ value: string }>(
      `SELECT value FROM settings WHERE \`key\` = 'default_teams_webhook'`
    );
    if (setting?.value) {
      await sendServerDownAlert(setting.value, server.name);
    }
  }
}

async function sendServerDownAlert(webhookUrl: string, serverName: string) {
  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `⚠️ Server ${serverName} is offline`,
              color: "Attention",
            },
            {
              type: "TextBlock",
              text: `No heartbeat received for over 60 seconds`,
              wrap: true,
            },
          ],
        },
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
  } catch (err) {
    console.error("Teams webhook error:", err);
  }
}

// Process health check alerts for status changes
export async function processHealthCheckAlerts(
  checkId: string,
  checkName: string,
  status: string,
  previousStatus: string
) {
  // Only alert on actual status changes involving "down"
  if (status === previousStatus) return;

  // Health check went DOWN (was up, now down)
  if (previousStatus !== "down" && status === "down") {
    await createHealthCheckAlert(
      checkId,
      "health_check_down",
      `🔴 Health Check **${checkName}** is DOWN`,
      "critical"
    );
    await sendHealthCheckTeamsAlert(checkId, checkName, "down");
  }

  // Health check RECOVERED (was down, now up)
  if (previousStatus === "down" && status === "up") {
    await createHealthCheckAlert(
      checkId,
      "health_check_recovered",
      `🟢 Health Check **${checkName}** has RECOVERED`,
      "info"
    );
    await sendHealthCheckTeamsAlert(checkId, checkName, "up");
  }
}

async function createHealthCheckAlert(
  checkId: string,
  type: string,
  message: string,
  severity: string
) {
  const id = generateId();
  await execute(
    `INSERT INTO alerts (id, server_id, app_id, type, message, severity)
     VALUES (?, NULL, NULL, ?, ?, ?)`,
    [id, type, message, severity]
  );
  
  // Store health_check_id in a way we can reference (using app_id field for now)
  // In production you'd want a health_check_id column in alerts
  return id;
}

async function sendHealthCheckTeamsAlert(
  checkId: string,
  checkName: string,
  status: "up" | "down"
) {
  // Get default webhook
  const setting = await queryOne<{ value: string }>(
    `SELECT value FROM settings WHERE \`key\` = 'default_teams_webhook'`
  );

  if (!setting?.value) return;

  const statusEmoji = status === "up" ? "🟢" : "🔴";
  const statusText = status === "up" ? "RECOVERED" : "DOWN";
  const color = status === "up" ? "Good" : "Attention";

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `${statusEmoji} Health Check: ${checkName} is ${statusText}`,
              color: color,
            },
            {
              type: "FactSet",
              facts: [
                { title: "Check", value: checkName },
                { title: "Status", value: statusText },
                { title: "Time", value: new Date().toISOString() },
              ],
            },
          ],
          msteams: { width: "Full" },
        },
      },
    ],
  };

  try {
    const res = await fetch(setting.value, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!res.ok) {
      console.error(`Health check Teams webhook failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Health check Teams webhook error:", err);
  }
}
