#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Auto-Deploy Script
#  Commits, pushes, closes GitHub issues, notifies via Telegram
# ═══════════════════════════════════════════════════════════════

set -e

REPO_DIR="/Users/akashkg/saanvi/babybloom"
BOT_DIR="$REPO_DIR/bot"
REPO="akashkguw/babybloom"

# Load secrets from .env
if [ -f "$BOT_DIR/.env" ]; then
  export $(grep -v '^#' "$BOT_DIR/.env" | xargs)
fi

GITHUB_TOKEN="${GITHUB_TOKEN}"
TELEGRAM_TOKEN="${TELEGRAM_BOT_TOKEN}"
CHAT_ID="${TELEGRAM_CHAT_ID:-8419867719}"

if [ -z "$GITHUB_TOKEN" ] || [ -z "$TELEGRAM_TOKEN" ]; then
  echo "Error: Missing tokens. Check bot/.env"
  exit 1
fi

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d parse_mode="Markdown" \
    -d disable_web_page_preview=true \
    -d text="$1" > /dev/null 2>&1
}

echo "🍼 BabyBloom Deploy Starting..."

cd "$REPO_DIR"

# Check if there are changes to commit
if git diff --quiet HEAD && [ -z "$(git status --porcelain)" ]; then
  echo "No changes to commit."
  send_telegram "ℹ️ *BabyBloom Deploy:* No changes to commit."
  exit 0
fi

# Stage all app changes (not .env or node_modules)
git add index.html sw.js README.md bot/bot.js bot/package.json bot/Dockerfile bot/.env.example bot/.gitignore bot/README.md bot/com.babybloom.telegram-bot.plist .github/ 2>/dev/null || true

# Get list of changed files for the commit message
CHANGED=$(git diff --cached --name-only | tr '\n' ', ' | sed 's/,$//')

if [ -z "$CHANGED" ]; then
  echo "No staged changes."
  exit 0
fi

echo "📦 Changed files: $CHANGED"

# Fetch open telegram issues to reference in commit
ISSUES=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/issues?labels=telegram&state=open&per_page=10")

ISSUE_NUMBERS=$(echo "$ISSUES" | python3 -c "
import sys,json
issues = json.load(sys.stdin)
for i in issues:
    print(i['number'])
" 2>/dev/null || true)

# Build closes string
CLOSES=""
for num in $ISSUE_NUMBERS; do
  CLOSES="$CLOSES closes #$num"
done

# Commit
COMMIT_MSG="Auto-deploy: update BabyBloom"
if [ -n "$CLOSES" ]; then
  COMMIT_MSG="Auto-deploy: update BabyBloom —${CLOSES}"
fi

git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || {
  send_telegram "❌ *BabyBloom Deploy FAILED:* git commit failed"
  exit 1
}

echo "📤 Pushing to main..."

# Push
git push origin main || {
  send_telegram "❌ *BabyBloom Deploy FAILED:* git push failed. Check your SSH keys or auth."
  exit 1
}

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "✅ Pushed: $COMMIT_SHA"

# Close issues and add comments
for num in $ISSUE_NUMBERS; do
  TITLE=$(echo "$ISSUES" | python3 -c "
import sys,json
issues = json.load(sys.stdin)
for i in issues:
    if i['number'] == $num:
        print(i['title'])
        break
" 2>/dev/null || echo "Issue #$num")

  # Add comment
  curl -s -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"body\":\"✅ Implemented and deployed in commit \`$COMMIT_SHA\`. Changes pushed to main.\"}" \
    "https://api.github.com/repos/$REPO/issues/$num/comments" > /dev/null 2>&1

  # Close issue
  curl -s -X PATCH \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"state":"closed","state_reason":"completed"}' \
    "https://api.github.com/repos/$REPO/issues/$num" > /dev/null 2>&1

  echo "✅ Closed issue #$num: $TITLE"
done

# Notify on Telegram
ISSUE_LIST=""
for num in $ISSUE_NUMBERS; do
  TITLE=$(echo "$ISSUES" | python3 -c "
import sys,json
issues = json.load(sys.stdin)
for i in issues:
    if i['number'] == $num:
        print(i['title'])
        break
" 2>/dev/null || echo "Issue #$num")
  ISSUE_LIST="$ISSUE_LIST
✅ #$num — $TITLE"
done

if [ -n "$ISSUE_LIST" ]; then
  send_telegram "🚀 *BabyBloom Deployed!*

📦 Commit: \`$COMMIT_SHA\`
📁 Changed: $CHANGED
$ISSUE_LIST

[View on GitHub](https://github.com/$REPO/commit/$COMMIT_SHA)"
else
  send_telegram "🚀 *BabyBloom Deployed!*

📦 Commit: \`$COMMIT_SHA\`
📁 Changed: $CHANGED

[View on GitHub](https://github.com/$REPO/commit/$COMMIT_SHA)"
fi

echo ""
echo "🎉 Deploy complete! Telegram notified."
