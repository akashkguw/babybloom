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

# ─── Clean up stale git lock files ───
rm -f "$REPO_DIR/.git/HEAD.lock" "$REPO_DIR/.git/index.lock" "$REPO_DIR/.git/MERGE_HEAD.lock" 2>/dev/null

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
  exit 0
fi

# ─── Stage only known safe files (never plist, .env, node_modules, logs) ───
# App source (Vite + React + TypeScript modular architecture)
git add src/ 2>/dev/null || true
git add index.html 2>/dev/null || true
git add package.json tsconfig.json vite.config.ts vitest.config.ts 2>/dev/null || true
git add .eslintrc.json 2>/dev/null || true
git add public/ 2>/dev/null || true

# Bot files (safe subset)
BOT_SAFE_FILES=(
  bot/bot.js
  bot/package.json
  bot/Dockerfile
  bot/.env.example
  bot/.gitignore
  bot/README.md
  bot/deploy.sh
  bot/WORKER_SKILL.md
  bot/pending-issues.json
  bot/pipeline.sh
)
for f in "${BOT_SAFE_FILES[@]}"; do
  [ -f "$f" ] && git add "$f" 2>/dev/null || true
done

# CI/CD and docs
git add .github/workflows/test.yml .github/workflows/deploy.yml 2>/dev/null || true
git add README.md MIGRATION_GUIDE.md ARCHITECTURE_PLAN.md 2>/dev/null || true
git add tests/ 2>/dev/null || true

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

# ─── Local CI checks (validate modular Vite + React + TS codebase) ───
echo "🧪 Running local CI checks..."
node -e "
const fs = require('fs');
const path = require('path');

// Recursively read all files in src/ as one blob for feature checks
function readDir(dir) {
  let content = '';
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) content += readDir(p);
    else if (f.name.match(/\.(tsx?|ts|jsx?)$/)) content += fs.readFileSync(p, 'utf8');
  }
  return content;
}
const src = readDir('src');

const checks = [
  ['React components','useState'],['IndexedDB','indexedDB'],
  ['Voice logging','SpeechRecognition'],['Feed merge','mergeIntoLastFeed'],
  ['Siri Shortcuts','SiriShortcutsSetup'],['Massage guide','MASSAGE_GUIDE'],
  ['Profile system','switchProfile'],['Dark mode','applyTheme'],
  ['Volume unit','volumeUnit'],['Timer view','TimerView'],
  ['Guide tab','GuideTab'],['Safety tab','SafetyTab'],
];
let fail=0;
checks.forEach(([n,p])=>{if(!src.includes(p)){console.log('FAIL:',n);fail++;}});
if(fail>0)process.exit(1);
console.log('All '+checks.length+' feature checks passed');
" || {
  send_telegram "🚨 *BabyBloom BLOCKER:* Local CI checks failed — deploy aborted."
  exit 1
}

# ─── Read implemented issues from pending-issues.json ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
IMPLEMENTED_DATA=$(python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status')=='implemented':
      print(str(i['number'])+'|'+i.get('title','').replace('|',' '))
except: pass
" 2>/dev/null || true)

CLOSES=""
while IFS='|' read -r num title; do
  num=$(echo "$num" | tr -d ' ')
  [ -z "$num" ] && continue
  CLOSES="$CLOSES closes #$num"
done <<< "$IMPLEMENTED_DATA"

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

# ─── Close implemented issues + comment on GitHub ───
ISSUE_LIST=""
while IFS='|' read -r num title; do
  num=$(echo "$num" | tr -d ' ')
  title=$(echo "$title" | xargs)
  [ -z "$num" ] && continue

  curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
    -d "{\"body\":\"✅ Implemented and deployed in [\`$COMMIT_SHA\`](https://github.com/$REPO/commit/$COMMIT_SHA).\"}" \
    "https://api.github.com/repos/$REPO/issues/$num/comments" > /dev/null 2>&1

  curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
    -d '{"state":"closed","state_reason":"completed"}' \
    "https://api.github.com/repos/$REPO/issues/$num" > /dev/null 2>&1

  echo "✅ Closed #$num: $title"
  ISSUE_LIST="$ISSUE_LIST\n✅ #$num — $title"
done <<< "$IMPLEMENTED_DATA"

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
