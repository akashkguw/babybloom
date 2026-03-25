#!/bin/bash
# ─── BabyBloom Dashboard Launcher ───────────────────────────────
#  Quick-start: bash start-dashboard.sh
#  Then open:   http://localhost:4040
# ────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

echo "🍼  Starting BabyBloom Dashboard..."

# Kill any existing dashboard on port 4040
lsof -ti:4040 | xargs kill -9 2>/dev/null

# Start dashboard in background
nohup node "$SCRIPT_DIR/dashboard.js" > "$SCRIPT_DIR/dashboard.log" 2>&1 &
DASH_PID=$!
echo "   PID: $DASH_PID"
sleep 1

# Open in browser
if command -v open &>/dev/null; then
  open "http://localhost:4040"
  echo "   Opened http://localhost:4040 in browser"
fi

echo "   Log: $SCRIPT_DIR/dashboard.log"
echo ""
