#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Native Pipeline
#  Runs on Mac (full network access) every 4 hours via LaunchAgent
#  Handles: push unpushed commits → close issues → Telegram notify
# ═══════════════════════════════════════════════════════════════

REPO_DIR="/Users/akashkg/saanvi/babybloom"
BOT_DIR="$REPO_DIR/bot"
REPO="akashkguw/babybloom"

# ─── Load secrets from .env ───
if [ -f "$BOT_DIR/.env" ]; then
  export $(grep -v '^#' "$BOT_DIR/.env" | xargs)
fi

GITHUB_TOKEN="${GITHUB_TOKEN}"
TELEGRAM_TOKEN="${TELEGRAM_BOT_TOKEN}"
CHAT_ID="${TELEGRAM_CHAT_ID}"

if [ -z "$GITHUB_TOKEN" ] || [ -z "$TELEGRAM_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "❌ Error: Missing tokens in bot/.env"
  exit 1
fi

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d parse_mode="Markdown" \
    -d disable_web_page_preview=true \
    --data-urlencode "text=$1" > /dev/null 2>&1
}

cd "$REPO_DIR"

echo "🔄 BabyBloom Pipeline — $(date)"

# ─── Ensure remote URL has token for HTTPS push ───
git remote set-url origin "https://akashkguw:${GITHUB_TOKEN}@github.com/${REPO}.git"

# ─── Check for uncommitted changes — run deploy.sh if needed ───
if ! git diff --quiet HEAD || [ -n "$(git status --porcelain)" ]; then
  echo "📝 Uncommitted changes found — running deploy.sh..."
  bash "$BOT_DIR/deploy.sh"
  exit $?
fi

# ─── Check for unpushed commits ───
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null)
if [ -z "$UNPUSHED" ]; then
  echo "ℹ️  Nothing to push."
  exit 0
fi

echo "📤 Found unpushed commits:"
echo "$UNPUSHED"

# ─── Get commit SHAs and messages for notification ───
COMMIT_SHA=$(git rev-parse --short HEAD)
COMMIT_COUNT=$(echo "$UNPUSHED" | wc -l | tr -d ' ')

# ─── Push ───
echo "📤 Pushing $COMMIT_COUNT commit(s) to main..."
if ! git push origin main 2>&1; then
  send_telegram "❌ *BabyBloom Deploy FAILED:* git push rejected. Check auth or secret scan."
  exit 1
fi
echo "✅ Push successful: $COMMIT_SHA"

# ─── Fetch open telegram-labeled issues ───
ISSUES=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/issues?labels=telegram&state=open&per_page=10")

ISSUE_NUMBERS=$(echo "$ISSUES" | python3 -c "
import sys,json
issues=json.load(sys.stdin)
for i in issues: print(i['number'])
" 2>/dev/null || true)

# ─── Close issues + comment ───
ISSUE_LIST=""
for num in $ISSUE_NUMBERS; do
  TITLE=$(echo "$ISSUES" | python3 -c "
import sys,json
issues=json.load(sys.stdin)
for i in issues:
    if i['number']==$num: print(i['title']); break
" 2>/dev/null || echo "Issue #$num")

  curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
    -d "{\"body\":\"✅ Implemented and deployed in [\`$COMMIT_SHA\`](https://github.com/$REPO/commit/$COMMIT_SHA).\"}" \
    "https://api.github.com/repos/$REPO/issues/$num/comments" > /dev/null 2>&1

  curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
    -d '{"state":"closed","state_reason":"completed"}' \
    "https://api.github.com/repos/$REPO/issues/$num" > /dev/null 2>&1

  echo "✅ Closed #$num: $TITLE"
  ISSUE_LIST="$ISSUE_LIST\n✅ #$num — $TITLE"
done

# ─── Telegram notification ───
MSG="🚀 *BabyBloom Deployed!*

📦 Commit: \`$COMMIT_SHA\` ($COMMIT_COUNT commit(s))"
[ -n "$ISSUE_LIST" ] && MSG="$MSG

Issues resolved:
$(echo -e "$ISSUE_LIST")"
MSG="$MSG

[View on GitHub](https://github.com/$REPO/commit/$COMMIT_SHA)"

send_telegram "$MSG"
echo "🎉 Pipeline complete! Telegram notified."
