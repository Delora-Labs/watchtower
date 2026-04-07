#!/bin/bash
# Watchtower Agent - Temporary bash version
# Run with: ./agent.sh

API_KEY="wt_heh7qevwy0omcvap9fz2lxait9r620wp"
DASHBOARD_URL="http://localhost:3020"
SERVER_ID="6ef77747-871e-48bf-8cf0-4a0b02ce43a3"
LAST_LOG_TIME=$(date +%s)

# Track last run time for each health check (file-based to survive subshells)
HEALTH_CHECK_STATE_FILE="/tmp/watchtower_health_check_state"
touch "$HEALTH_CHECK_STATE_FILE"

get_last_run() {
  grep "^$1:" "$HEALTH_CHECK_STATE_FILE" 2>/dev/null | cut -d: -f2 || echo "0"
}

set_last_run() {
  grep -v "^$1:" "$HEALTH_CHECK_STATE_FILE" > "${HEALTH_CHECK_STATE_FILE}.tmp" 2>/dev/null || true
  echo "$1:$2" >> "${HEALTH_CHECK_STATE_FILE}.tmp"
  mv "${HEALTH_CHECK_STATE_FILE}.tmp" "$HEALTH_CHECK_STATE_FILE"
}

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
      
      # Skip PM2 system messages first
      if echo "$CLEAN_LINE" | grep -qE '^PM2[[:space:]]+\|'; then
        continue
      fi

      # Skip noisy Next.js Server Action errors (stale deployment cache)
      if echo "$CLEAN_LINE" | grep -qE 'Failed to find Server Action'; then
        continue
      fi
      
      # Try to extract app name - PM2 format is: "ID|appname   | message"
      # Using awk for more reliable parsing
      if echo "$CLEAN_LINE" | grep -qE '^[0-9]+\|'; then
        APP_NAME=$(echo "$CLEAN_LINE" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
        MESSAGE=$(echo "$CLEAN_LINE" | awk -F'|' '{$1=""; $2=""; gsub(/^[ \t|]+/, ""); print}')
        # Fallback if awk extraction failed
        if [ -z "$MESSAGE" ] || [ "$MESSAGE" = "$CLEAN_LINE" ]; then
          MESSAGE=$(echo "$CLEAN_LINE" | sed -E 's/^[0-9]+\|[^|]+\|[ ]*//')
        fi
      fi
      
      # Default to unknown if still empty
      [ -z "$APP_NAME" ] && APP_NAME="unknown"
      
      # Skip if message is empty after extraction
      [ -z "$(echo "$MESSAGE" | tr -d '[:space:]')" ] && continue
      
      # Determine log level from content
      # First check for explicit level tags like [INFO], [ERROR], [WARN], [DEBUG]
      LEVEL="info"
      if echo "$MESSAGE" | grep -qE '\[ERROR\]|\[error\]'; then
        LEVEL="error"
      elif echo "$MESSAGE" | grep -qE '\[WARN\]|\[warn\]|\[WARNING\]|\[warning\]'; then
        LEVEL="warn"
      elif echo "$MESSAGE" | grep -qE '\[DEBUG\]|\[debug\]'; then
        LEVEL="debug"
      elif echo "$MESSAGE" | grep -qE '\[INFO\]|\[info\]'; then
        LEVEL="info"
      else
        # Fallback to keyword detection only if no explicit tag found
        echo "$MESSAGE" | grep -qiE '(error:|exception|fatal|failed:|crash)' && LEVEL="error"
        echo "$MESSAGE" | grep -qiE '(warn:|warning:)' && LEVEL="warn"
      fi
      
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
  
  # Check for commands (format: action:app:id:token)
  COMMANDS=$(echo "$RESPONSE" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (data.commands && data.commands.length > 0) {
  data.commands.forEach(cmd => {
    console.log(cmd.action + ':' + cmd.app + ':' + cmd.id + ':' + (cmd.token || ''));
  });
}
" 2>/dev/null)

  # Execute commands
  for CMD in $COMMANDS; do
    ACTION=$(echo "$CMD" | cut -d: -f1)
    APP=$(echo "$CMD" | cut -d: -f2)
    CMD_ID=$(echo "$CMD" | cut -d: -f3)
    TOKEN=$(echo "$CMD" | cut -d: -f4)
    
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
      RAW_LOGS=$(pm2 logs "$APP" --nostream --lines 100 2>&1)
      RESULT=$?
      CMD_RESULT=$(echo "$RAW_LOGS" | \
        sed 's/\x1b\[[0-9;]*m//g' | \
        grep -vE '(Tailing last|\.pm2/logs/|last [0-9]+ lines)' | \
        grep -vE '^[├└│─┼┤┬┴]+' | \
        sed 's/^[[:space:]]*$//' | \
        grep -v '^$')
    elif [ "$ACTION" = "pull" ] || [ "$ACTION" = "install" ] || [ "$ACTION" = "build" ] || [ "$ACTION" = "deploy" ]; then
      # Get app's working directory from PM2
      APP_DIR=$(pm2 jlist 2>/dev/null | node -e "
        const apps = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        const app = apps.find(a => a.name === '$APP');
        if (app) console.log(app.pm2_env.pm_cwd || app.pm2_env.cwd || '');
      " 2>/dev/null)
      
      if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
        CMD_RESULT="Error: Could not find app directory for $APP"
        RESULT=1
      else
        echo "Deploying $APP in $APP_DIR..."
        cd "$APP_DIR"
        
        if [ "$ACTION" = "pull" ]; then
          CMD_RESULT=$(git pull 2>&1)
          RESULT=$?
        elif [ "$ACTION" = "install" ]; then
          if [ -f "pnpm-lock.yaml" ]; then
            CMD_RESULT=$(pnpm install 2>&1)
          elif [ -f "yarn.lock" ]; then
            CMD_RESULT=$(yarn install 2>&1)
          else
            CMD_RESULT=$(npm install 2>&1)
          fi
          RESULT=$?
        elif [ "$ACTION" = "build" ]; then
          if [ -f "pnpm-lock.yaml" ]; then
            CMD_RESULT=$(pnpm build 2>&1)
          elif [ -f "yarn.lock" ]; then
            CMD_RESULT=$(yarn build 2>&1)
          else
            CMD_RESULT=$(npm run build 2>&1)
          fi
          RESULT=$?
        elif [ "$ACTION" = "deploy" ]; then
          # Full deploy: pull + install + build + restart
          CMD_RESULT="=== Git Pull ===\n"
          if [ -n "$TOKEN" ]; then
            # Use token for private repos
            git config credential.helper store
            echo "https://oauth2:${TOKEN}@github.com" > ~/.git-credentials-temp
            CMD_RESULT+=$(git -c credential.helper='store --file ~/.git-credentials-temp' pull 2>&1)
            rm -f ~/.git-credentials-temp
          else
            CMD_RESULT+=$(git pull 2>&1)
          fi
          CMD_RESULT+="\n\n=== Install ===\n"
          if [ -f "pnpm-lock.yaml" ]; then
            CMD_RESULT+=$(pnpm install 2>&1)
          elif [ -f "yarn.lock" ]; then
            CMD_RESULT+=$(yarn install 2>&1)
          else
            CMD_RESULT+=$(npm install 2>&1)
          fi
          CMD_RESULT+="\n\n=== Build ===\n"
          if [ -f "pnpm-lock.yaml" ]; then
            CMD_RESULT+=$(pnpm build 2>&1)
          elif [ -f "yarn.lock" ]; then
            CMD_RESULT+=$(yarn build 2>&1)
          else
            CMD_RESULT+=$(npm run build 2>&1)
          fi
          CMD_RESULT+="\n\n=== Restart ===\n"
          CMD_RESULT+=$(pm2 restart "$APP" 2>&1)
          RESULT=$?
        fi
      fi
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
  
  # Perform HTTP health checks (respecting intervals)
  HEALTH_CHECKS=$(curl -s "$DASHBOARD_URL/api/health-checks/active" \
    -H "Authorization: Bearer $API_KEY" 2>/dev/null)
  
  if [ -n "$HEALTH_CHECKS" ] && [ "$HEALTH_CHECKS" != "null" ]; then
    CURRENT_TIME=$(date +%s)
    
    # Parse and check each URL (now includes interval_ms)
    echo "$HEALTH_CHECKS" | node -e "
const json = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const data = json.data || json;
if (Array.isArray(data)) {
  data.forEach(check => {
    console.log(check.id + '|' + check.url + '|' + (check.expected_status || 200) + '|' + (check.interval_ms || 60000));
  });
}
" 2>/dev/null | while IFS='|' read -r CHECK_ID URL EXPECTED_STATUS INTERVAL_MS; do
      [ -z "$CHECK_ID" ] && continue
      
      # Convert interval to seconds
      INTERVAL_SEC=$((INTERVAL_MS / 1000))
      [ "$INTERVAL_SEC" -lt 30 ] && INTERVAL_SEC=30  # Minimum 30 seconds
      
      # Check if enough time has passed since last run
      LAST_RUN=$(get_last_run "$CHECK_ID")
      TIME_SINCE=$((CURRENT_TIME - LAST_RUN))
      
      if [ "$TIME_SINCE" -lt "$INTERVAL_SEC" ]; then
        # Skip this check - not time yet
        continue
      fi
      
      # Update last run time
      set_last_run "$CHECK_ID" "$CURRENT_TIME"
      
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
      
      echo "[Health Check] $URL -> $HTTP_CODE ($STATUS, ${RESPONSE_TIME}ms, interval: ${INTERVAL_SEC}s)"
    done
  fi
  
  # Send recent logs every cycle
  send_logs
  
  sleep 30
done
