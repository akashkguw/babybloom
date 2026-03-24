#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Native Pipeline
#  Runs on Mac (full network access) every 4 hours via LaunchAgent
#  Handles: push unpushed commits → close issues → Telegram notify
# ═══════════════════════════════════════════════════════════════

REPO_DIR="/Users/akashkg/saanvi/babybloom"
BOT_DIR="$REPO_DIR/bot"
REPO="akashkguw/babybloom"

# ─── Ensure PATH includes common tool locations (LaunchAgents use minimal PATH) ───
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

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
  local input="${1:-$(cat)}"
  echo "$input" | sed "s/\`/'/g" | sed 's/_/\\_/g'
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
import urllib.request, json, os, ssl

# Fix macOS Python SSL cert issue
try:
    import certifi
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.load_default_certs()

token = "$GITHUB_TOKEN"
repo  = "$REPO"
queue_path = "$QUEUE_FILE"

# Fetch open telegram-labeled issues from GitHub
try:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues?labels=telegram&state=open&per_page=50",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    gh_issues = json.loads(urllib.request.urlopen(req, timeout=10, context=ssl_ctx).read())
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
DEPLOY_PUSHED_SHA=""
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  echo "📝 Uncommitted changes found — running deploy.sh..."
  bash "$BOT_DIR/deploy.sh"
  # Capture the SHA deploy.sh just pushed so we can wait for CI below
  DEPLOY_PUSHED_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "")
  echo "📌 deploy.sh pushed: $DEPLOY_PUSHED_SHA"
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

# ─── Notify failed issues (leave open on GitHub for retry) ───
if [ -f "$QUEUE_FILE" ]; then
  FAILED=$(python3 -c "
import sys,json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status')=='failed':
      print(i['number'],'|',i.get('title',''),'|',i.get('failure_reason','Unknown failure'))
except: pass
" 2>/dev/null || true)

  while IFS='|' read -r num title reason; do
    num=$(echo "$num" | tr -d ' ')
    title=$(echo "$title" | xargs)
    reason=$(echo "$reason" | xargs)
    [ -z "$num" ] && continue

    curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
      -d "{\"body\":\"⚠️ Implementation attempted but failed.\\n\\n**Reason:** $reason\\n\\n_Will retry on next pipeline run if re-opened._\"}" \
      "https://api.github.com/repos/$REPO/issues/$num/comments" > /dev/null 2>&1

    send_telegram "⚠️ *BabyBloom: Implementation Failed*

🔢 Issue: #$num
📌 Title: $title
💥 Reason: $reason

The issue remains open on GitHub for manual review or retry.
🔗 [View issue](https://github.com/$REPO/issues/$num)"

    echo "⚠️ Failed & notified: #$num — $title"
  done <<< "$FAILED"

  # Remove failed issues from queue
  python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  remaining=[i for i in q if i.get('status')!='failed']
  json.dump(remaining,open('$QUEUE_FILE','w'),indent=2)
except: pass
" 2>/dev/null || true
fi

# ─── Post analysis results as GitHub comments (leave issue open) ───
if [ -f "$QUEUE_FILE" ]; then
  ANALYZED=$(python3 -c "
import sys,json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status')=='analyzed' and i.get('analysis_result'):
      import base64
      enc=base64.b64encode(i['analysis_result'].encode()).decode()
      print(i['number'],'|',i.get('title',''),'|',enc)
except: pass
" 2>/dev/null || true)

  while IFS='|' read -r num title enc; do
    num=$(echo "$num" | tr -d ' ')
    title=$(echo "$title" | xargs)
    enc=$(echo "$enc" | tr -d ' ')
    [ -z "$num" ] && continue

    # Decode and post analysis as GitHub comment
    python3 -c "
import urllib.request, json, base64, ssl
try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()
analysis = base64.b64decode('$enc').decode()
body = json.dumps({'body': '🔍 **Analysis by Claude**\n\n' + analysis})
req = urllib.request.Request(
  'https://api.github.com/repos/$REPO/issues/$num/comments',
  data=body.encode(), method='POST',
  headers={'Authorization':'Bearer $GITHUB_TOKEN','Content-Type':'application/json'}
)
urllib.request.urlopen(req, timeout=10, context=ctx)
print('Posted analysis for #$num')
" 2>/dev/null || echo "⚠️ Could not post analysis for #$num"

    send_telegram "🔍 *BabyBloom: Analysis Complete*

🔢 Issue: #$num
📌 Title: $title

Claude has posted findings as a comment on the GitHub issue.
🔗 [View analysis](https://github.com/$REPO/issues/$num)"

    echo "🔍 Analysis posted: #$num — $title"
  done <<< "$ANALYZED"

  # Remove analyzed issues from queue
  python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  remaining=[i for i in q if i.get('status')!='analyzed']
  json.dump(remaining,open('$QUEUE_FILE','w'),indent=2)
except: pass
" 2>/dev/null || true
fi

# ─── Check for unpushed commits (or use SHA already pushed by deploy.sh) ───
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null)
COMMIT_SHA=""
COMMIT_COUNT=0

if [ -n "$UNPUSHED" ]; then
  echo "📤 Found unpushed commits:"
  echo "$UNPUSHED"
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
elif [ -n "$DEPLOY_PUSHED_SHA" ]; then
  # deploy.sh already pushed — use its SHA for CI wait + notification
  COMMIT_SHA="$DEPLOY_PUSHED_SHA"
  COMMIT_COUNT=1
  echo "ℹ️  deploy.sh already pushed $COMMIT_SHA — checking CI status..."
else
  echo "ℹ️  Nothing to push."
  exit 0
fi

# ─── Read local issue queue (written by bot.js, no API needed) ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
ISSUE_LIST=""

if [ -f "$QUEUE_FILE" ]; then
  # Get all completed issues (implemented, infra_implemented, documented)
  IMPLEMENTED=$(python3 -c "
import sys,json
try:
  q=json.load(open('$QUEUE_FILE'))
  done_statuses = {'implemented', 'infra_implemented', 'documented'}
  for i in q:
    if i.get('status') in done_statuses: print(i['number'],'|',i.get('title',''))
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

  # Remove deployed issues from queue (all completed statuses)
  python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  done_statuses = {'implemented', 'infra_implemented', 'documented'}
  remaining=[i for i in q if i.get('status') not in done_statuses]
  json.dump(remaining,open('$QUEUE_FILE','w'),indent=2)
except: pass
" 2>/dev/null || true
fi

# ─── Wait for GitHub Actions result ───
echo "⏳ Waiting for GitHub Actions to complete..."
DEPLOY_TIME=$(date "+%b %d, %Y at %I:%M %p")
ACTIONS_STATUS="unknown"
ACTIONS_URL="https://github.com/$REPO/actions"
RUN_URL=""

# Poll for up to 5 minutes (30 attempts × 10s)
for i in $(seq 1 30); do
  sleep 10
  RUNS=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO/actions/runs?branch=main&per_page=5" 2>/dev/null)

  STATUS=$(echo "$RUNS" | python3 -c "
import sys,json
try:
  runs=json.loads(sys.stdin.read()).get('workflow_runs',[])
  for r in runs:
    if r.get('head_sha','').startswith('$COMMIT_SHA') or r.get('head_sha','')=='$(git rev-parse HEAD)':
      print(r['status']+'|'+r['conclusion']+'|'+r['html_url'])
      break
except: pass
" 2>/dev/null)

  if [ -n "$STATUS" ]; then
    RUN_STATUS=$(echo "$STATUS" | cut -d'|' -f1)
    RUN_CONCLUSION=$(echo "$STATUS" | cut -d'|' -f2)
    RUN_URL=$(echo "$STATUS" | cut -d'|' -f3)
    if [ "$RUN_STATUS" = "completed" ]; then
      ACTIONS_STATUS="$RUN_CONCLUSION"
      echo "✅ GitHub Actions completed: $RUN_CONCLUSION"
      break
    else
      echo "⏳ Build in progress ($i/30)... status: $RUN_STATUS"
    fi
  else
    echo "⏳ Waiting for run to appear ($i/30)..."
  fi
done

# ─── Gather extra context for notification ───
COMMIT_MSGS=$(git log origin/main~${COMMIT_COUNT}..origin/main --pretty=format:"• %s" 2>/dev/null | head -5 | sanitize)
PENDING_COUNT=$(python3 -c "
import json
try:
  q=json.load(open('$BOT_DIR/pending-issues.json'))
  print(len([i for i in q if i.get('status')=='pending']))
except: print(0)
" 2>/dev/null || echo 0)

# ─── Telegram notification with real CI result ───
if [ "$ACTIONS_STATUS" = "success" ]; then
  STATUS_LINE="✅ *Build & Deploy: PASSED*"
  LIVE_LINE="🌐 [Open Live App](https://akashkguw.github.io/babybloom/)"
elif [ "$ACTIONS_STATUS" = "failure" ]; then
  STATUS_LINE="❌ *Build & Deploy: FAILED*"
  LIVE_LINE="🔗 [View failed run]($RUN_URL)"
else
  STATUS_LINE="⚠️ *Build status: unknown (timed out waiting)*"
  LIVE_LINE="🔗 [Check Actions]($ACTIONS_URL)"
fi

MSG="🍼 *BabyBloom Pipeline Complete*
━━━━━━━━━━━━━━━━━━━━
$STATUS_LINE
🕐 *Time:* $DEPLOY_TIME
📦 *Commit:* \`$COMMIT_SHA\`
📝 *Pushed:* $COMMIT_COUNT commit(s)"

[ -n "$COMMIT_MSGS" ] && MSG="$MSG

*What changed:*
$COMMIT_MSGS"

[ -n "$ISSUE_LIST" ] && MSG="$MSG

*Issues resolved:*
$(echo -e "$ISSUE_LIST" | sanitize)"

[ "$PENDING_COUNT" -gt "0" ] 2>/dev/null && MSG="$MSG

⏳ *Still pending:* $PENDING_COUNT issue(s) — Claude will implement next cycle."

MSG="$MSG

$LIVE_LINE
📊 [All issues](https://github.com/$REPO/issues)"

send_telegram "$MSG"
echo "🎉 Pipeline complete! Telegram notified with CI result: $ACTIONS_STATUS"
