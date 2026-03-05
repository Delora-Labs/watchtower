# Watchtower

Lightweight server and application monitoring system for PM2-managed apps.

## Features

- 📊 Real-time PM2 process monitoring (CPU, memory, uptime, restarts)
- 🔔 Notifications via Microsoft Teams webhooks
- 👥 Multi-user with roles (system_admin, team_lead, user)
- 🏢 Team-based app assignments
- 🩺 HTTP health checks with configurable intervals
- 📜 Centralized log collection and viewing
- 📈 Analytics with historical metrics
- 🚀 One-click deploy (git pull + build + restart)
- 🔐 GitHub token integration for private repos

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Server A       │     │  Server B       │     │  Server C       │
│  (agent)        │     │  (agent)        │     │  (agent)        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │ HTTP (heartbeat every 30s)
                                 ▼
                    ┌────────────────────────┐
                    │   Watchtower Dashboard │
                    │   (Next.js + MySQL)    │
                    └────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 15, React, Tailwind CSS, Recharts
- **Backend**: Next.js API Routes
- **Database**: MySQL 8
- **Agent**: Bash script with PM2

---

## Server Migration Guide

### Prerequisites on New Server

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# PM2
npm install -g pm2

# pnpm (optional, for faster installs)
npm install -g pnpm
```

### 1. Clone the Repository

```bash
cd ~/workspace
git clone https://github.com/Delora-Labs/watchtower.git
cd watchtower
```

### 2. Install Dependencies

```bash
pnpm install
# or: npm install
```

### 3. Configure Environment

Create `.env` file:

```bash
# Database
DB_HOST=46.101.215.137
DB_PORT=3306
DB_USERNAME=watchtower
DB_PASSWORD=your_password_here
DB_DATABASE=watchtower

# Optional: Anthropic API for log analysis
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Database Setup

If migrating to a new database, run the schema:

```bash
# Option 1: Run schema.sql directly
mysql -h $DB_HOST -u $DB_USERNAME -p$DB_PASSWORD $DB_DATABASE < schema.sql

# Option 2: Run migrations
node scripts/run-migrations.js
```

**Current Tables:**
- `servers` - Registered servers
- `apps` - PM2 applications
- `app_assignments` - Team assignments for apps
- `app_metrics` - Historical CPU/memory data
- `app_logs` - Collected logs
- `users` - Dashboard users
- `teams` - Team definitions
- `commands` - Pending commands for agents
- `alerts` - Alert history
- `health_checks` - HTTP health check configs
- `health_check_results` - Health check history

### 5. Build & Start

```bash
# Build production
pnpm build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Or manually:
pm2 start "npm run start" --name watchtower
```

### 6. Reverse Proxy (Caddy)

Add to `/etc/caddy/Caddyfile`:

```
watchtower.yourdomain.com {
    tls /path/to/cert.pem /path/to/key.pem
    reverse_proxy localhost:3020
}
```

Reload: `sudo caddy reload --config /etc/caddy/Caddyfile`

---

## Agent Installation

### On Each Monitored Server

```bash
curl -fsSL https://watchtower.deloralabs.com/install.sh | bash -s -- \
  --key "YOUR_API_KEY" \
  --server "YOUR_SERVER_ID"
```

Get `--key` and `--server` from the dashboard: **Add Server** button.

### Manual Agent Setup

```bash
mkdir -p ~/.watchtower

# Download agent
curl -fsSL https://watchtower.deloralabs.com/agent.sh -o ~/.watchtower/agent.sh
chmod +x ~/.watchtower/agent.sh

# Create config
cat > ~/.watchtower/config.env << EOF
WATCHTOWER_API_KEY=your_api_key
WATCHTOWER_SERVER_ID=your_server_id
WATCHTOWER_URL=https://watchtower.yourdomain.com
EOF

# Create wrapper
cat > ~/.watchtower/run-agent.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.env"
export API_KEY="$WATCHTOWER_API_KEY"
export DASHBOARD_URL="$WATCHTOWER_URL"
export SERVER_ID="$WATCHTOWER_SERVER_ID"
exec "$SCRIPT_DIR/agent.sh"
EOF
chmod +x ~/.watchtower/run-agent.sh

# Create PM2 ecosystem (use first 8 chars of server ID)
SHORT_ID=$(echo "$WATCHTOWER_SERVER_ID" | cut -c1-8)
cat > ~/.watchtower/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'watchtower-agent-$SHORT_ID',
    script: '$HOME/.watchtower/run-agent.sh',
    interpreter: '/bin/bash',
    autorestart: true,
    watch: false,
    max_memory_restart: '100M'
  }]
};
EOF

# Start agent
pm2 start ~/.watchtower/ecosystem.config.js
pm2 save
```

### Agent Naming Convention

Agents are named `watchtower-agent-{first-8-chars-of-server-id}`:
- `watchtower-agent-6ef77747`
- `watchtower-agent-f462b842`

This allows filtering PM2 logs by server.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | No | MySQL port (default: 3306) |
| `DB_USERNAME` | Yes | MySQL user |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_DATABASE` | Yes | Database name |
| `ANTHROPIC_API_KEY` | No | For AI log analysis |

### User Roles

| Role | Permissions |
|------|-------------|
| `system_admin` | Full access, manage users/teams, delete servers |
| `team_lead` | Manage team apps, deploy, add servers |
| `user` | View assigned apps only |

### Health Check Intervals

Available intervals: 1min, 5min, 15min, 30min, 1hr, 6hr

Health checks only run on servers where `run_health_check = TRUE`.

---

## API Reference

### Authentication

All API requests require session cookie (dashboard) or API key (agent):

```bash
# Agent requests
curl -H "Authorization: Bearer wt_xxx" https://watchtower.../api/heartbeat
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/servers` | GET | List servers with apps |
| `/api/servers` | POST | Create new server |
| `/api/servers/[id]` | PATCH | Update server |
| `/api/servers/[id]` | DELETE | Delete server |
| `/api/apps/[id]` | PATCH | Update app settings |
| `/api/apps/[id]` | DELETE | Delete app |
| `/api/apps/[id]/deploy` | POST | Queue deploy |
| `/api/heartbeat` | POST | Agent heartbeat |
| `/api/logs` | GET | Fetch logs |
| `/api/logs` | POST | Submit logs (agent) |
| `/api/health-checks` | GET/POST | Manage health checks |
| `/api/health-checks/active` | GET | Get enabled checks (agent) |

---

## Troubleshooting

### Agent not reporting

```bash
# Check agent status
pm2 status watchtower-agent-*

# Check agent logs
pm2 logs watchtower-agent-* --lines 50

# Verify connectivity
curl -s https://watchtower.yourdomain.com/api/health
```

### Deploy failing

1. Check GitHub token is set in Settings
2. Verify token has `repo` scope
3. Check agent logs for git errors

### Health checks not running

1. Verify `run_health_check` is ON for the server (edit server)
2. Check agent has latest version: `grep GH_TOKEN ~/.watchtower/agent.sh`
3. Restart agent: `pm2 restart watchtower-agent-*`

---

## Development

```bash
# Run in development mode
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm lint
```

---

## File Structure

```
watchtower/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── analytics/        # Analytics page
│   │   ├── healthcheck/      # Health check detail
│   │   ├── logs/             # Logs viewer
│   │   ├── settings/         # Settings page
│   │   ├── login/            # Login page
│   │   └── page.tsx          # Dashboard
│   ├── components/           # React components
│   └── lib/                  # Utilities, DB, auth
├── public/
│   ├── agent.sh              # Agent script (served to clients)
│   └── install.sh            # Install script
├── schema.sql                # Database schema
├── migrations/               # Database migrations
└── ecosystem.config.js       # PM2 config for dashboard
```

---

## License

Proprietary - Delora Labs
