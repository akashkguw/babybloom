#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Native Pipeline
#  Runs on Mac (full network access) every 4 hours via LaunchAgent
#  Handles: push unpushed commits → close issues → Telegram notify
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
  echo "❌ Error: Missing tokens in bot/.env"
  exit 1
fi

# Escape dynamic content that may contain Markdown-breaking characters
# Strips backticks, underscores outside *bold* markers, and bare brackets
sanitize() {
  echo "$1" | sed "s/\`/'/g" | sed 's/_/\\_/g'
}

send_telegram() {
  RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d parse_mode="Markdown" \
    -d disable_web_page_preview=true \
    --data-urlencode "text=$1" 2>&1)
  if echo "$RESULT" | grep -q '"ok":false'; then
    echo "⚠️  Telegram send failed (Markdown), retrying as plain text..."
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      -d chat_id="$CHAT_ID" \
      -d disable_web_page_preview=true \
      --data-urlencode "text=$1" > /dev/null 2>&1
  fi
}

cd "$REPO_DIR"

echo "🔄 BabyBloom Pipeline — $(date)"

# ─── Ensure remote URL has token for HTTPS push ───
git remote set-url origin "https://akashkguw:${GITHUB_TOKEN}@github.com/${REPO}.git"

# ─── Sync open GitHub issues → pending-issues.json (auto-backfill) ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
python3 - <<EOF
import urllib.request, json, os

token = "$GITHUB_TOKEN"
repo  = "$REPO"
queue_path = "$QUEUE_FILE"

# Fetch open telegram-labeled issues from GitHub
try:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues?labels=telegram&state=open&per_page=50",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    gh_issues = json.loads(urllib.request.urlopen(req, timeout=10).read())
except Exception as e:
    print(f"⚠️  GitHub sync skipped: {e}")
    gh_issues = []

# Load existing queue
try:
    queue = json.load(open(queue_path))
except:
    queue = []

existing_nums = {i["number"] for i in queue}
added = 0
for i in gh_issues:
    if i["number"] not in existing_nums:
        queue.append({
            "number": i["number"],
            "title": i["title"],
            "body": i["body"] or "",
            "labels": [l["name"] for l in i["labels"]],
            "url": i["html_url"],
            "created_at": i["created_at"],
            "status": "pending"
        })
        added += 1

if added:
    json.dump(queue, open(queue_path, "w"), indent=2)
    print(f"📥 Synced {added} new issue(s) into queue")
else:
    print("✅ Queue already up to date")
EOF

# ─── Check for uncommitted changes — run deploy.sh if needed ───
# Use grep -v '??' to exclude untracked files (like pending-issues.json, logs)
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  echo "📝 Uncommitted changes found — running deploy.sh..."
  bash "$BOT_DIR/deploy.sh"
  exit $?
fi

# ─── Always: notify any rejected issues first ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
if [ -f "$QUEUE_FILE" ]; then
  REJECTED=$(python3 -c "
import sys,json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status')=='rejected':
      print(i['number'],'|',i.get('title',''),'|',i.get('rejection_reason','No reason given'))
except: pass
" 2>/dev/null || true)

  while IFS='|' read -r num title reason; do
    num=$(echo "$num" | tr -d ' ')
    title=$(echo "$title" | xargs)
    reason=$(echo "$reason" | xargs)
    [ -z "$num" ] && continue

    curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
      -d "{\"body\":\"🚫 Request rejected by automated safety review.\\n\\n**Reason:** $reason\"}" \
      "https://api.github.com/repos/$REPO/issues/$num/comments" > /dev/null 2>&1

    curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
      -d '{"state":"closed","state_reason":"not_planned"}' \
      "https://api.github.com/repos/$REPO/issues/$num" > /dev/null 2>&1

    send_telegram "🚫 *BabyBloom: Request Rejected*

🔢 Issue: #$num
📌 Title: $title
❌ Reason: $reason

This request was blocked by the safety review and will not be implemented.
🔗 [View issue](https://github.com/$REPO/issues/$num)"

    echo "🚫 Rejected & notified: #$num — $title"
  done <<< "$REJECTED"

  # Remove rejected issues from queue
  python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  remaining=[i for i in q if i.get('status')!='rejected']
  json.dump(remaining,open('$QUEUE_FILE','w'),indent=2)
except: pass
" 2>/dev/null || true
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
  send_telegram "❌ *BabyBloom Deploy FAILED*

📦 Commit: \`$COMMIT_SHA\`
🕐 Time: $(date '+%b %d at %I:%M %p')
💥 Reason: git push rejected

Check GitHub token permissions or secret scan logs.
🔗 [View repo](https://github.com/$REPO)"
  exit 1
fi
echo "✅ Push successful: $COMMIT_SHA"

# ─── Read local issue queue (written by bot.js, no API needed) ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
ISSUE_LIST=""

if [ -f "$QUEUE_FILE" ]; then
  # Get all "implemented" issues (Claude marked them after coding)
  IMPLEMENTED=$(python3 -c "
import sys,json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status')=='implemented': print(i['number'],'|',i.get('title',''))
except: pass
" 2>/dev/null || true)

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
  done <<< "$IMPLEMENTED"

  # Remove deployed issues from queue
  python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  remaining=[i for i in q if i.get('status')!='implemented']
  json.dump(remaining,open('$QUEUE_FILE','w'),indent=2)
except: pass
" 2>/dev/null || true
fi

# ─── Gather extra context for notification ───
DEPLOY_TIME=$(date "+%b %d, %Y at %I:%M %p")
# Sanitize commit messages — strip backticks and escape underscores
COMMIT_MSGS=$(git log origin/main~${COMMIT_COUNT}..origin/main --pretty=format:"• %s" 2>/dev/null | head -5 | sanitize)
PENDING_COUNT=$(python3 -c "
import json
try:
  q=json.load(open('$BOT_DIR/pending-issues.json'))
  print(len([i for i in q if i.get('status')=='pending']))
except: print(0)
" 2>/dev/null || echo 0)

# ─── Telegram notification ───
MSG="🍼 *BabyBloom Update Deployed!*
━━━━━━━━━━━━━━━━━━━━
🕐 *Time:* $DEPLOY_TIME
📦 *Commit:* $COMMIT_SHA
📝 *Changes pushed:* $COMMIT_COUNT commit(s)"

[ -n "$COMMIT_MSGS" ] && MSG="$MSG

*What changed:*
$COMMIT_MSGS"

[ -n "$ISSUE_LIST" ] && MSG="$MSG

✅ *Issues resolved:*
$(echo -e "$ISSUE_LIST" | sanitize)"

[ "$PENDING_COUNT" -gt "0" ] 2>/dev/null && MSG="$MSG

⏳ *Still pending:* $PENDING_COUNT issue(s) in queue — Claude will implement next cycle."

MSG="$MSG

🔗 [View commit on GitHub](https://github.com/$REPO/commit/$COMMIT_SHA)
📊 [All issues](https://github.com/$REPO/issues)"

send_telegram "$MSG"
echo "🎉 Pipeline complete! Telegram notified."
