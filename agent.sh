#!/bin/bash
# Watchtower Agent - Temporary bash version
# Run with: ./agent.sh

API_KEY="wt_heh7qevwy0omcvap9fz2lxait9r620wp"
DASHBOARD_URL="http://localhost:3020"
SERVER_ID="6ef77747-871e-48bf-8cf0-4a0b02ce43a3"
LAST_LOG_TIME=$(date +%s)

# Function to collect and send logs
send_logs() {
  # Get recent PM2 logs (last 30 seconds worth)
  LOGS=$(pm2 logs --nostream --lines 50 --raw 2>/dev/null | tail -20)
  
  if [ -n "$LOGS" ]; then
    # Parse and send logs
    echo "$LOGS" | while IFS= read -r line; do
      # Skip empty lines
      [ -z "$line" ] && continue
      
      # Extract app name if present (format: "PM2 | app-name | message")
      APP_NAME=$(echo "$line" | grep -oP '^\d+\|[\w-]+' | cut -d'|' -f2 | tr -d ' ' || echo "system")
      
      # Determine log level
      LEVEL="info"
      echo "$line" | grep -qi "error" && LEVEL="error"
      echo "$line" | grep -qi "warn" && LEVEL="warn"
      
      # Send to dashboard
      curl -s -X POST "$DASHBOARD_URL/api/logs" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"server_id\": \"$SERVER_ID\", \"app_name\": \"$APP_NAME\", \"level\": \"$LEVEL\", \"message\": $(echo "$line" | jq -Rs .)}" \
        >/dev/null 2>&1
    done
  fi
}

while true; do
  # Get PM2 data
  PM2_JSON=$(pm2 jlist 2>/dev/null)
  
  # Build payload
  PAYLOAD=$(node -e "
const os = require('os');
const pm2Data = $PM2_JSON;

const payload = {
  hostname: os.hostname(),
  os: os.platform() + ' ' + os.release(),
  ip: '64.226.86.114',
  system: {
    cpu: Math.round(os.loadavg()[0] * 10),
    memoryUsed: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
    memoryTotal: Math.round(os.totalmem() / 1024 / 1024),
    diskUsed: 45
  },
  apps: pm2Data.map(app => ({
    pm2_id: app.pm_id,
    name: app.name,
    status: app.pm2_env.status,
    cpu: app.monit?.cpu || 0,
    memory: Math.round((app.monit?.memory || 0) / 1024 / 1024),
    uptime: Date.now() - app.pm2_env.pm_uptime,
    restarts: app.pm2_env.restart_time
  }))
};

console.log(JSON.stringify(payload));
")

  # Send heartbeat
  RESPONSE=$(curl -s -X POST "$DASHBOARD_URL/api/heartbeat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$PAYLOAD")
  
  # Check for commands
  COMMANDS=$(echo "$RESPONSE" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (data.commands && data.commands.length > 0) {
  data.commands.forEach(cmd => {
    console.log(cmd.action + ':' + cmd.app + ':' + cmd.id);
  });
}
" 2>/dev/null)

  # Execute commands
  for CMD in $COMMANDS; do
    ACTION=$(echo "$CMD" | cut -d: -f1)
    APP=$(echo "$CMD" | cut -d: -f2)
    CMD_ID=$(echo "$CMD" | cut -d: -f3)
    
    RESULT=1
    if [ "$ACTION" = "restart" ]; then
      echo "Restarting $APP..."
      pm2 restart "$APP" 2>&1
      RESULT=$?
    elif [ "$ACTION" = "start" ]; then
      echo "Starting $APP..."
      pm2 start "$APP" 2>&1
      RESULT=$?
    elif [ "$ACTION" = "stop" ]; then
      echo "Stopping $APP..."
      pm2 stop "$APP" 2>&1
      RESULT=$?
    fi
    
    # Report completion
    curl -s -X PATCH "$DASHBOARD_URL/api/commands/$CMD_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $API_KEY" \
      -d "{\"success\": $([ $RESULT -eq 0 ] && echo 'true' || echo 'false')}"
  done
  
  # Send recent logs every cycle
  send_logs
  
  sleep 30
done
