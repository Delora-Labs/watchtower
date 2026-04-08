#!/bin/bash
# Watchtower Agent
# Monitors PM2 apps and reports to dashboard

# Config from environment (set by run-agent.sh or manually)
API_KEY="${API_KEY:-$WATCHTOWER_API_KEY}"
DASHBOARD_URL="${DASHBOARD_URL:-$WATCHTOWER_URL:-http://localhost:3020}"
SERVER_ID="${SERVER_ID:-$WATCHTOWER_SERVER_ID}"

if [ -z "$API_KEY" ] || [ -z "$SERVER_ID" ]; then
  echo "❌ Missing configuration. Set API_KEY and SERVER_ID environment variables."
  echo "   Or run the installer: curl -fsSL https://watchtower.deloralabs.com/install.sh | bash"
  exit 1
fi

echo "🗼 Watchtower Agent starting..."
echo "   Dashboard: $DASHBOARD_URL"
echo "   Server ID: $SERVER_ID"

# State file to track last sent logs
LOG_STATE_FILE="/tmp/watchtower_log_state"
touch "$LOG_STATE_FILE" 2>/dev/null

# Function to generate hash for deduplication (server_id + app_name + message + minute)
generate_hash() {
  local app="$1"
  local message="$2"
  # Include timestamp rounded to minute for time-based dedup
  local minute=$(date +%Y%m%d%H%M)
  echo -n "${SERVER_ID}|${app}|${message}|${minute}" | md5sum | cut -d' ' -f1
}

# Function to collect and send logs in batch
send_logs() {
  LOGS=$(pm2 logs --nostream --lines 50 2>/dev/null | tail -30)

  if [ -z "$LOGS" ]; then
    return
  fi

  # First pass: parse lines into app_name + message pairs
  declare -a PARSED_APPS=()
  declare -a PARSED_MSGS=()

  while IFS= read -r line; do
    CLEAN_LINE=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
    [ -z "$(echo "$CLEAN_LINE" | tr -d '[:space:]')" ] && continue
    echo "$CLEAN_LINE" | grep -qE '(Tailing last|\.pm2/logs/|last [0-9]+ lines)' && continue
    echo "$CLEAN_LINE" | grep -qE '^[├└│─┼┤┬┴]+' && continue

    if echo "$CLEAN_LINE" | grep -qE '^PM2[[:space:]]+\|'; then
      continue
    fi

    APP_NAME=""
    MESSAGE="$CLEAN_LINE"

    if echo "$CLEAN_LINE" | grep -qE '^[0-9]+\|'; then
      APP_NAME=$(echo "$CLEAN_LINE" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
      MESSAGE=$(echo "$CLEAN_LINE" | awk -F'|' '{$1=""; $2=""; gsub(/^[ \t|]+/, ""); print}')
      if [ -z "$MESSAGE" ] || [ "$MESSAGE" = "$CLEAN_LINE" ]; then
        MESSAGE=$(echo "$CLEAN_LINE" | sed -E 's/^[0-9]+\|[^|]+\|[ ]*//')
      fi
    fi

    [ -z "$APP_NAME" ] && APP_NAME="unknown"
    [ -z "$(echo "$MESSAGE" | tr -d '[:space:]')" ] && continue

    # Skip watchtower agent's own logs to prevent feedback loop
    if echo "$MESSAGE" | grep -qE '^\[(Logs|CMD|Health Check)\] '; then
      continue
    fi

    PARSED_APPS+=("$APP_NAME")
    PARSED_MSGS+=("$MESSAGE")
  done <<< "$LOGS"

  # Second pass: merge consecutive lines from the same app into one message
  # A new log group starts when: app changes, or line looks like a new log entry
  declare -a MERGED_APPS=()
  declare -a MERGED_MSGS=()
  declare -a MERGED_LEVELS=()

  for i in "${!PARSED_APPS[@]}"; do
    APP_NAME="${PARSED_APPS[$i]}"
    MESSAGE="${PARSED_MSGS[$i]}"

    # Detect if this line starts a new log entry (has a recognizable prefix)
    IS_NEW_ENTRY=false
    if echo "$MESSAGE" | grep -qE '^(GET |POST |PUT |PATCH |DELETE |HEAD |OPTIONS |✓ |Error:|error:|Warning:|warn:|INFO|WARN|ERROR|DEBUG|\[|[0-9]{4}-[0-9]{2})'; then
      IS_NEW_ENTRY=true
    fi

    PREV_IDX=$((${#MERGED_APPS[@]} - 1))

    if [ "$PREV_IDX" -ge 0 ] && [ "${MERGED_APPS[$PREV_IDX]}" = "$APP_NAME" ] && [ "$IS_NEW_ENTRY" = false ]; then
      # Continuation line - append to previous entry
      MERGED_MSGS[$PREV_IDX]="${MERGED_MSGS[$PREV_IDX]}"$'\n'"$MESSAGE"
    else
      # New log entry
      MERGED_APPS+=("$APP_NAME")
      MERGED_MSGS+=("$MESSAGE")
      MERGED_LEVELS+=("")
    fi
  done

  # Build JSON array from merged logs
  LOG_ARRAY="["
  FIRST=true
  SENT_HASHES=""

  for i in "${!MERGED_APPS[@]}"; do
    APP_NAME="${MERGED_APPS[$i]}"
    MESSAGE="${MERGED_MSGS[$i]}"

    # Determine log level from first line
    LEVEL="info"
    FIRST_LINE=$(echo "$MESSAGE" | head -1)
    if echo "$FIRST_LINE" | grep -qE '\[ERROR\]|\[error\]'; then
      LEVEL="error"
    elif echo "$FIRST_LINE" | grep -qE '\[WARN\]|\[warn\]|\[WARNING\]|\[warning\]'; then
      LEVEL="warn"
    elif echo "$FIRST_LINE" | grep -qE '\[DEBUG\]|\[debug\]'; then
      LEVEL="debug"
    elif echo "$FIRST_LINE" | grep -qE '\[INFO\]|\[info\]'; then
      LEVEL="info"
    else
      echo "$FIRST_LINE" | grep -qiE '(error:|exception|fatal|failed:|crash)' && LEVEL="error"
      echo "$FIRST_LINE" | grep -qiE '(warn:|warning:)' && LEVEL="warn"
    fi

    # Generate hash from full merged message
    HASH=$(generate_hash "$APP_NAME" "$MESSAGE")

    # Skip duplicates
    if echo "$SENT_HASHES" | grep -q "$HASH"; then
      continue
    fi
    if grep -q "^$HASH$" "$LOG_STATE_FILE" 2>/dev/null; then
      continue
    fi

    SENT_HASHES="$SENT_HASHES $HASH"

    MESSAGE_JSON=$(echo "$MESSAGE" | jq -Rs .)

    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      LOG_ARRAY+=","
    fi

    LOG_ARRAY+="{\"server_id\": \"$SERVER_ID\", \"app_name\": \"$APP_NAME\", \"level\": \"$LEVEL\", \"message\": $MESSAGE_JSON, \"hash\": \"$HASH\"}"
  done

  LOG_ARRAY+="]"
  
  # Only send if we have logs
  if [ "$LOG_ARRAY" != "[]" ]; then
    RESPONSE=$(curl -s -X POST "$DASHBOARD_URL/api/logs" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $API_KEY" \
      -d "$LOG_ARRAY" 2>&1)
    
    # Update state file with sent hashes (keep only current batch)
    echo "$SENT_HASHES" | tr ' ' '\n' | grep -v '^$' > "$LOG_STATE_FILE"
    
    # Log batch send result
    INSERTED=$(echo "$RESPONSE" | jq -r '.inserted // 0' 2>/dev/null)
    SKIPPED=$(echo "$RESPONSE" | jq -r '.skipped // 0' 2>/dev/null)
    if [ -n "$INSERTED" ] && [ "$INSERTED" != "null" ] && [ "$INSERTED" != "0" ]; then
      echo "[Logs] Sent batch: $INSERTED inserted, $SKIPPED skipped (duplicates)"
    fi
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
  ip: '$(curl -s ifconfig.me 2>/dev/null || echo "unknown")',
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
    GH_TOKEN=$(echo "$CMD" | cut -d: -f4)
    
    RESULT=1
    CMD_RESULT=""
    if [ "$ACTION" = "restart" ]; then
      echo "[CMD] Restarting $APP..."
      pm2 restart "$APP" 2>&1
      RESULT=$?
    elif [ "$ACTION" = "start" ]; then
      echo "[CMD] Starting $APP..."
      pm2 start "$APP" 2>&1
      RESULT=$?
    elif [ "$ACTION" = "stop" ]; then
      echo "[CMD] Stopping $APP..."
      pm2 stop "$APP" 2>&1
      RESULT=$?
    elif [ "$ACTION" = "logs" ]; then
      echo "[CMD] Fetching logs for $APP..."
      RAW_LOGS=$(pm2 logs "$APP" --nostream --lines 100 2>&1)
      RESULT=$?
      CMD_RESULT=$(echo "$RAW_LOGS" | \
        sed 's/\x1b\[[0-9;]*m//g' | \
        grep -vE '(Tailing last|\.pm2/logs/|last [0-9]+ lines)' | \
        grep -vE '^[├└│─┼┤┬┴]+' | \
        sed 's/^[[:space:]]*$//' | \
        grep -v '^$')
    elif [ "$ACTION" = "pull" ] || [ "$ACTION" = "install" ] || [ "$ACTION" = "build" ] || [ "$ACTION" = "deploy" ]; then
      APP_DIR=$(pm2 jlist 2>/dev/null | node -e "
        const apps = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        const app = apps.find(a => a.name === '$APP');
        if (app) console.log(app.pm2_env.pm_cwd || app.pm2_env.cwd || '');
      " 2>/dev/null)
      
      if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
        CMD_RESULT="Error: Could not find app directory for $APP"
        RESULT=1
      else
        echo "[CMD] Deploying $APP in $APP_DIR..."
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
          CMD_RESULT="=== Git Pull ===\n"
          if [ -n "$GH_TOKEN" ]; then
            # Use token for private repos - set up credential helper temporarily
            CRED_FILE="/tmp/.git-creds-$$"
            echo "https://oauth2:${GH_TOKEN}@github.com" > "$CRED_FILE"
            CMD_RESULT+=$(git -c credential.helper="store --file=$CRED_FILE" pull 2>&1)
            rm -f "$CRED_FILE"
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
  
  HEALTH_STATE_FILE="/tmp/watchtower_health_state"
  touch "$HEALTH_STATE_FILE" 2>/dev/null
  
  if [ -n "$HEALTH_CHECKS" ] && [ "$HEALTH_CHECKS" != "null" ]; then
    CURRENT_TIME=$(date +%s)
    
    # Parse checks into temp file (avoid subshell issue with pipes)
    CHECKS_FILE="/tmp/watchtower_checks_$$"
    echo "$HEALTH_CHECKS" | node -e "
const json = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const data = json.data || json;
if (Array.isArray(data)) {
  data.forEach(check => {
    console.log(check.id + '|' + check.url + '|' + (check.expected_status || 200) + '|' + (check.interval_ms || 60000));
  });
}
" 2>/dev/null > "$CHECKS_FILE"

    # Process each check
    while IFS='|' read -r CHECK_ID URL EXPECTED_STATUS INTERVAL_MS; do
      [ -z "$CHECK_ID" ] && continue
      
      # Convert interval to seconds (minimum 30s)
      INTERVAL_SEC=$((INTERVAL_MS / 1000))
      [ "$INTERVAL_SEC" -lt 30 ] && INTERVAL_SEC=30
      
      # Check last run time from state file
      LAST_RUN=$(grep "^${CHECK_ID}:" "$HEALTH_STATE_FILE" 2>/dev/null | cut -d: -f2)
      LAST_RUN=${LAST_RUN:-0}
      TIME_SINCE=$((CURRENT_TIME - LAST_RUN))
      
      # Skip if not enough time has passed
      if [ "$TIME_SINCE" -lt "$INTERVAL_SEC" ]; then
        continue
      fi
      
      # Update state file with current time
      grep -v "^${CHECK_ID}:" "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" 2>/dev/null || true
      echo "${CHECK_ID}:${CURRENT_TIME}" >> "${HEALTH_STATE_FILE}.tmp"
      mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
      
      # Perform the check
      START_TIME=$(date +%s%3N)
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>/dev/null || echo "000")
      END_TIME=$(date +%s%3N)
      RESPONSE_TIME=$((END_TIME - START_TIME))
      
      if [ "$HTTP_CODE" -eq "${EXPECTED_STATUS:-200}" ]; then
        STATUS="healthy"
      elif [ "$HTTP_CODE" -eq "000" ]; then
        STATUS="timeout"
      else
        STATUS="unhealthy"
      fi
      
      curl -s -X POST "$DASHBOARD_URL/api/health-checks/$CHECK_ID/results" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"status\": \"$STATUS\", \"response_time_ms\": $RESPONSE_TIME, \"status_code\": $HTTP_CODE}" \
        >/dev/null 2>&1
      
      echo "[Health Check] $URL -> $HTTP_CODE ($STATUS, ${RESPONSE_TIME}ms, next in ${INTERVAL_SEC}s)"
    done < "$CHECKS_FILE"
    
    rm -f "$CHECKS_FILE"
  fi
  
  # Send recent logs (batched)
  send_logs
  
  sleep 30
done
