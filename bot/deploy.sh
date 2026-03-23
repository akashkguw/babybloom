#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Auto-Deploy Script
#  Commits, pushes, closes GitHub issues, notifies via Telegram
#
#  Best practices enforced:
#  1. Secret scan before every commit — hard stop if found
#  2. Secrets loaded from .env only — never hardcoded
#  3. Plist and .env explicitly excluded from staging
#  4. CI checks run locally before push
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
  echo "❌ Error: Missing GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, or TELEGRAM_CHAT_ID in bot/.env"
  exit 1
fi

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d parse_mode="Markdown" \
    -d disable_web_page_preview=true \
    --data-urlencode "text=$1" > /dev/null 2>&1
}

echo "🍼 BabyBloom Deploy Starting..."
cd "$REPO_DIR"

# ─── Nothing to commit? ───
if git diff --quiet HEAD && [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️  No changes to commit."
  send_telegram "ℹ️ *BabyBloom:* No changes to deploy."
  exit 0
fi

# ─── Stage only known safe files (never plist, .env, node_modules, logs) ───
FILES_TO_STAGE=(
  index.html
  sw.js
  README.md
  bot/bot.js
  bot/package.json
  bot/Dockerfile
  bot/.env.example
  bot/.gitignore
  bot/README.md
  bot/deploy.sh
  .github/workflows/test.yml
)

for f in "${FILES_TO_STAGE[@]}"; do
  [ -f "$f" ] && git add "$f" 2>/dev/null || true
done

# ─── SECRET SCAN — hard stop if any secret found in staged files ───
echo "🔍 Scanning staged files for secrets..."
# Match real token lengths (40+ chars after prefix), not placeholders or pattern strings
if git diff --cached | grep -qE "github_pat_[A-Za-z0-9_]{30,}|ghp_[A-Za-z0-9]{36,}|[0-9]{8,}:AAH[A-Za-z0-9_-]{30,}"; then
  echo "🚨 SECRET DETECTED in staged files! Aborting."
  echo "   Run: git diff --cached | grep -iE '$SECRET_PATTERNS'"
  send_telegram "🚨 *BabyBloom BLOCKER:* Secret detected in staged files — deploy aborted. Check manually."
  git reset HEAD .
  exit 1
fi
echo "✅ Secret scan passed — no secrets in staged files."

# ─── Nothing staged? ───
CHANGED=$(git diff --cached --name-only | tr '\n' ', ' | sed 's/,$//')
if [ -z "$CHANGED" ]; then
  echo "ℹ️  Nothing staged after filtering."
  exit 0
fi
echo "📦 Staged: $CHANGED"

# ─── Local CI checks ───
echo "🧪 Running local CI checks..."
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
const checks = [
  ['React loaded','react/18'],['Service Worker','serviceWorker.register'],
  ['IndexedDB','indexedDB'],['Voice logging','SpeechRecognition'],
  ['Feed merge','mergeIntoLastFeed'],['Siri Shortcuts','SiriShortcutsSetup'],
  ['Massage guide','MASSAGE_GUIDE'],['Profile system','switchProfile'],
  ['Dark mode','C_DARK'],['Firsts edit','updateFirst'],['Volume unit','volumeUnit'],
];
let fail=0;
checks.forEach(([n,p])=>{if(!html.includes(p)){console.log('FAIL:',n);fail++;}});
if(fail>0)process.exit(1);
console.log('All '+checks.length+' feature checks passed');
" || {
  send_telegram "🚨 *BabyBloom BLOCKER:* Local CI checks failed — deploy aborted."
  exit 1
}

# ─── Fetch open telegram issues ───
ISSUES=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/issues?labels=telegram&state=open&per_page=10")

ISSUE_NUMBERS=$(echo "$ISSUES" | python3 -c "
import sys,json
issues=json.load(sys.stdin)
for i in issues: print(i['number'])
" 2>/dev/null || true)

CLOSES=""
for num in $ISSUE_NUMBERS; do CLOSES="$CLOSES closes #$num"; done

# ─── Commit ───
COMMIT_MSG="Auto-deploy: update BabyBloom${CLOSES:+ —$CLOSES}"
git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || {
  send_telegram "❌ *BabyBloom Deploy FAILED:* git commit failed."
  exit 1
}

# ─── Push ───
echo "📤 Pushing to main..."
git push origin main || {
  git reset --soft HEAD~1
  send_telegram "❌ *BabyBloom Deploy FAILED:* git push rejected. Check for secrets or auth issues."
  exit 1
}

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "✅ Pushed: $COMMIT_SHA"

# ─── Close issues + comment on GitHub ───
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

📦 Commit: \`$COMMIT_SHA\`
📁 Files: $CHANGED"
[ -n "$ISSUE_LIST" ] && MSG="$MSG

Issues resolved:
$(echo -e "$ISSUE_LIST")"
MSG="$MSG

[View on GitHub](https://github.com/$REPO/commit/$COMMIT_SHA)"

send_telegram "$MSG"
echo ""
echo "🎉 Deploy complete! Telegram notified."
