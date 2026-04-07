import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { getUserFromSession, canRestartApps } from "@/lib/auth";
import { generateId } from "@/lib/utils";

interface App {
  id: string;
  pm2_name: string;
  server_id: string;
  git_repo: string | null;
}

interface Server {
  id: string;
  name: string;
  api_key: string;
}

// POST /api/apps/[id]/deploy - Queue a deploy command for the agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check auth
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Only team_lead+ can deploy
    if (!canRestartApps(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get app details
    const app = await queryOne<App>(
      "SELECT id, pm2_name, server_id, git_repo FROM apps WHERE id = ?",
      [id]
    );

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Get server details
    const server = await queryOne<Server>(
      "SELECT id, name, api_key FROM servers WHERE id = ?",
      [app.server_id]
    );

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Get user's GitHub token
    const userWithToken = await queryOne<{ github_token: string | null }>(
      "SELECT github_token FROM users WHERE id = ?",
      [user.id]
    );

    const githubToken = userWithToken?.github_token || null;

    // Validate pm2_name to prevent shell injection
    const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;
    if (!SAFE_NAME_PATTERN.test(app.pm2_name)) {
      return NextResponse.json(
        { error: "Invalid app name: contains disallowed characters" },
        { status: 400 }
      );
    }

    // Build the deploy command
    // The command will be executed in the app's directory (derived from pm2 cwd)
    const deployScript = `
trap 'rm -f ~/.git-credentials-temp' EXIT

cd "$(pm2 describe ${app.pm2_name} 2>/dev/null | grep 'exec cwd' | awk '{print $NF}')" 2>/dev/null || cd ~/workspace/${app.pm2_name} || exit 1

echo "=== Starting deploy for ${app.pm2_name} ==="
echo "Directory: $(pwd)"

# Configure git with token if provided
${githubToken ? `
touch ~/.git-credentials-temp
chmod 600 ~/.git-credentials-temp
echo "https://oauth2:${githubToken.replace(/'/g, "'\\''")}@github.com" > ~/.git-credentials-temp
git -c credential.helper='store --file ~/.git-credentials-temp' pull
` : 'git pull'}

echo "=== Installing dependencies ==="
npm install || pnpm install || yarn install

echo "=== Removing .next cache ==="
rm -rf .next

echo "=== Building ==="
npm run build || pnpm build || yarn build

echo "=== Restarting PM2 ==="
pm2 restart ${app.pm2_name}

echo "=== Deploy complete ==="
`.trim();

    // Queue the command for the agent (use the commands table that the agent checks)
    const commandId = generateId();
    await execute(
      `INSERT INTO commands (id, server_id, app_name, action, status, created_by, created_at)
       VALUES (?, ?, ?, 'deploy', 'pending', ?, NOW())`,
      [commandId, server.id, app.pm2_name, user.id]
    );

    return NextResponse.json({ 
      success: true, 
      commandId,
      message: `Deploy queued for ${app.pm2_name}. Agent will execute on next heartbeat (~30s).`
    });
  } catch (error) {
    console.error("Deploy error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
