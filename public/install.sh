#!/bin/bash
# Watchtower Agent Installer
# Usage: curl -fsSL https://watchtower.deloralabs.com/install.sh | bash -s -- --key "API_KEY" --server "SERVER_ID"

set -e

DASHBOARD_URL="https://watchtower.deloralabs.com"
API_KEY=""
SERVER_ID=""
INSTALL_DIR="$HOME/.watchtower"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --key|-k)
      API_KEY="$2"
      shift 2
      ;;
    --server|-s)
      SERVER_ID="$2"
      shift 2
      ;;
    --url)
      DASHBOARD_URL="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo "🗼 Watchtower Agent Installer"
echo "=============================="
echo ""

# Check if credentials provided
if [ -z "$API_KEY" ] || [ -z "$SERVER_ID" ]; then
  echo "❌ Missing credentials!"
  echo ""
  echo "Usage:"
  echo "  curl -fsSL $DASHBOARD_URL/install.sh | bash -s -- --key YOUR_API_KEY --server YOUR_SERVER_ID"
  echo ""
  echo "Get your credentials from the Watchtower dashboard:"
  echo "  1. Go to $DASHBOARD_URL"
  echo "  2. Click 'Add Server'"
  echo "  3. Copy the install command shown"
  echo ""
  exit 1
fi

echo "Dashboard: $DASHBOARD_URL"
echo "Server ID: $SERVER_ID"
echo ""

# Check dependencies
echo "Checking dependencies..."
MISSING=0
for cmd in curl jq pm2; do
  if ! command -v $cmd &> /dev/null; then
    echo "❌ Missing: $cmd"
    if [ "$cmd" = "jq" ]; then
      echo "   Install with: sudo apt install jq"
    elif [ "$cmd" = "pm2" ]; then
      echo "   Install with: npm install -g pm2"
    fi
    MISSING=1
  fi
done

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "Please install missing dependencies and try again."
  exit 1
fi
echo "✅ All dependencies found"
echo ""

# Create install directory
mkdir -p "$INSTALL_DIR"

# Save config
cat > "$INSTALL_DIR/config.env" << EOF
WATCHTOWER_API_KEY=$API_KEY
WATCHTOWER_SERVER_ID=$SERVER_ID
WATCHTOWER_URL=$DASHBOARD_URL
EOF

echo "✅ Config saved to $INSTALL_DIR/config.env"

# Download agent script
echo "Downloading agent..."
curl -fsSL "$DASHBOARD_URL/agent.sh" -o "$INSTALL_DIR/agent.sh"
chmod +x "$INSTALL_DIR/agent.sh"
echo "✅ Agent downloaded to $INSTALL_DIR/agent.sh"

# Create wrapper script that loads config
cat > "$INSTALL_DIR/run-agent.sh" << 'WRAPPER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.env"

export API_KEY="$WATCHTOWER_API_KEY"
export DASHBOARD_URL="$WATCHTOWER_URL"
export SERVER_ID="$WATCHTOWER_SERVER_ID"

exec "$SCRIPT_DIR/agent.sh"
WRAPPER
chmod +x "$INSTALL_DIR/run-agent.sh"

# Create PM2 ecosystem file (use short server ID in name for uniqueness)
SHORT_ID=$(echo "$SERVER_ID" | cut -c1-8)
cat > "$INSTALL_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'watchtower-agent-$SHORT_ID',
    script: '$INSTALL_DIR/run-agent.sh',
    interpreter: '/bin/bash',
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Verify connection
echo ""
echo "Verifying connection to dashboard..."
VERIFY=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$DASHBOARD_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{\"serverId\": \"$SERVER_ID\", \"apps\": []}")

if [ "$VERIFY" = "200" ] || [ "$VERIFY" = "201" ]; then
  echo "✅ Connection verified!"
else
  echo "⚠️  Could not verify connection (HTTP $VERIFY)"
  echo "   The agent may still work - check the dashboard after starting."
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ Installation complete!"
echo "════════════════════════════════════════"
echo ""
echo "To start the agent:"
echo "  pm2 start $INSTALL_DIR/ecosystem.config.js"
echo "  pm2 save"
echo ""
echo "To check status:"
echo "  pm2 status watchtower-agent-$SHORT_ID"
echo "  pm2 logs watchtower-agent-$SHORT_ID"
echo ""
echo "Dashboard: $DASHBOARD_URL"
