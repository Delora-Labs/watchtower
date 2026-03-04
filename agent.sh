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
  LOGS=$(pm2 logs --nostream --lines 50 2>/dev/null | tail -30)
  
  if [ -n "$LOGS" ]; then
    # Parse and send logs
    echo "$LOGS" | while IFS= read -r line; do
      # Strip ANSI color codes
      CLEAN_LINE=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
      
      # Skip empty lines and whitespace-only lines
      [ -z "$(echo "$CLEAN_LINE" | tr -d '[:space:]')" ] && continue
      
      # Skip PM2 header lines
      echo "$CLEAN_LINE" | grep -qE '(Tailing last|\.pm2/logs/|last [0-9]+ lines)' && continue
      
      # Skip PM2 table formatting lines (box drawing chars)
      echo "$CLEAN_LINE" | grep -qE '^[├└│─┼┤┬┴]+' && continue
      
      # Extract app name from PM2 prefix format: "22|watchtower  | message" or "22|app-name |message"
      APP_NAME=""
      MESSAGE="$CLEAN_LINE"
      if echo "$CLEAN_LINE" | grep -qE '^[0-9]+\|[^|]+\|'; then
        APP_NAME=$(echo "$CLEAN_LINE" | sed -E 's/^[0-9]+\|([^|]+)\|.*/\1/' | xargs)
        MESSAGE=$(echo "$CLEAN_LINE" | sed -E 's/^[0-9]+\|[^|]+\|[ ]*//')
      fi
      [ -z "$APP_NAME" ] && APP_NAME="system"
      
      # Skip if message is empty after extraction
      [ -z "$(echo "$MESSAGE" | tr -d '[:space:]')" ] && continue
      
      # Determine log level from content
      LEVEL="info"
      echo "$MESSAGE" | grep -qiE '(error|exception|fatal|failed|crash)' && LEVEL="error"
      echo "$MESSAGE" | grep -qiE '(warn|warning)' && LEVEL="warn"
      echo "$MESSAGE" | grep -qiE '(debug)' && LEVEL="debug"
      
      # Send to dashboard
      curl -s -X POST "$DASHBOARD_URL/api/logs" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"server_id\": \"$SERVER_ID\", \"app_name\": \"$APP_NAME\", \"level\": \"$LEVEL\", \"message\": $(echo "$MESSAGE" | jq -Rs .)}" \
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
    CMD_RESULT=""
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
    elif [ "$ACTION" = "logs" ]; then
      echo "Fetching logs for $APP..."
      # Get raw logs and clean them
      RAW_LOGS=$(pm2 logs "$APP" --nostream --lines 100 2>&1)
      RESULT=$?
      # Strip ANSI codes, remove PM2 headers, keep meaningful content
      CMD_RESULT=$(echo "$RAW_LOGS" | \
        sed 's/\x1b\[[0-9;]*m//g' | \
        grep -vE '(Tailing last|\.pm2/logs/|last [0-9]+ lines)' | \
        grep -vE '^[├└│─┼┤┬┴]+' | \
        sed 's/^[[:space:]]*$//' | \
        grep -v '^$')
    fi
    
    # Report completion
    if [ -n "$CMD_RESULT" ]; then
      # For commands with output (like logs), include the result text
      curl -s -X PATCH "$DASHBOARD_URL/api/commands/$CMD_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"success\": $([ $RESULT -eq 0 ] && echo 'true' || echo 'false'), \"result\": $(echo "$CMD_RESULT" | jq -Rs .)}"
    else
      curl -s -X PATCH "$DASHBOARD_URL/api/commands/$CMD_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"success\": $([ $RESULT -eq 0 ] && echo 'true' || echo 'false')}"
    fi
  done
  
  # Perform HTTP health checks
  HEALTH_CHECKS=$(curl -s "$DASHBOARD_URL/api/health-checks/active" \
    -H "Authorization: Bearer $API_KEY" 2>/dev/null)
  
  if [ -n "$HEALTH_CHECKS" ] && [ "$HEALTH_CHECKS" != "null" ]; then
    # Parse and check each URL
    echo "$HEALTH_CHECKS" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (Array.isArray(data)) {
  data.forEach(check => {
    console.log(check.id + '|' + check.url + '|' + (check.expected_status || 200));
  });
}
" 2>/dev/null | while IFS='|' read -r CHECK_ID URL EXPECTED_STATUS; do
      [ -z "$CHECK_ID" ] && continue
      
      # Measure response time and get status code
      START_TIME=$(date +%s%3N)
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>/dev/null || echo "000")
      END_TIME=$(date +%s%3N)
      RESPONSE_TIME=$((END_TIME - START_TIME))
      
      # Determine status based on HTTP code
      if [ "$HTTP_CODE" -eq "${EXPECTED_STATUS:-200}" ]; then
        STATUS="healthy"
      elif [ "$HTTP_CODE" -eq "000" ]; then
        STATUS="timeout"
      else
        STATUS="unhealthy"
      fi
      
      # Report result to dashboard
      curl -s -X POST "$DASHBOARD_URL/api/health-checks/$CHECK_ID/results" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"status\": \"$STATUS\", \"response_time_ms\": $RESPONSE_TIME, \"status_code\": $HTTP_CODE}" \
        >/dev/null 2>&1
      
      echo "[Health Check] $URL -> $HTTP_CODE ($STATUS, ${RESPONSE_TIME}ms)"
    done
  fi
  
  # Send recent logs every cycle
  send_logs
  
  sleep 30
done
