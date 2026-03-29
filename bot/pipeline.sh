#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Native Pipeline
#  Runs on Mac every 60s via LaunchAgent
#  Handles: sync issues → Claude CLI process → deploy → notify
#  Only proceeds if there are issues to work on or completed
#  issues to deploy. Does NOT deploy unrelated uncommitted changes.
# ═══════════════════════════════════════════════════════════════

REPO_DIR="/Users/akashkg/saanvi/babybloom"
BOT_DIR="$REPO_DIR/bot"
REPO="akashkguw/babybloom"
LOCK_FILE="$BOT_DIR/.pipeline.lock"

# ─── Run lock: skip if another pipeline run is still active ───
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    # Still running — exit silently (don't spam the log every 60s)
    exit 0
  fi
  # Stale lock (process died) — clean up and continue
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Ensure PATH includes common tool locations (LaunchAgents use minimal PATH) ───
# NVM node (find latest installed version)
NVM_NODE_DIR="$HOME/.nvm/versions/node"
if [ -d "$NVM_NODE_DIR" ]; then
  NVM_LATEST=$(ls "$NVM_NODE_DIR" 2>/dev/null | sort -V | tail -1)
  [ -n "$NVM_LATEST" ] && export PATH="$NVM_NODE_DIR/$NVM_LATEST/bin:$PATH"
fi
# Homebrew, system, and user-local paths
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"

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
GH_ADDED=$(python3 - <<EOF
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

# Fetch all open issues from GitHub (telegram + manually created)
try:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues?state=open&per_page=50",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    gh_issues = json.loads(urllib.request.urlopen(req, timeout=10, context=ssl_ctx).read())
except Exception as e:
    print(0, end="")  # Signal no new issues
    import sys; print(f"⚠️  GitHub sync skipped: {e}", file=sys.stderr)
    exit(0)

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
    import sys; print(f"📥 Synced {added} new issue(s) into queue", file=sys.stderr)

print(added, end="")
EOF
)
if [ "$GH_ADDED" -gt 0 ] 2>/dev/null; then
  echo "📥 Synced $GH_ADDED issue(s) into queue"
else
  echo "Queue already up to date"
fi

# ─── Sync unresolved Sentry issues → GitHub Issues → pending queue ───
if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then
  echo "🔍 Checking Sentry for new errors..."
  python3 - <<SENTRY_EOF
import urllib.request, json, ssl, os

try:
    import certifi; ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ssl_ctx = ssl.create_default_context(); ssl_ctx.load_default_certs()

sentry_token = "$SENTRY_AUTH_TOKEN"
sentry_org   = "$SENTRY_ORG"
sentry_proj  = "$SENTRY_PROJECT"
gh_token     = "$GITHUB_TOKEN"
repo         = "$REPO"
queue_path   = "$QUEUE_FILE"

# Track which Sentry issues we've already created GH issues for
tracker_path = "$BOT_DIR/sentry-tracked.json"
try:
    tracked = json.load(open(tracker_path))
except:
    tracked = {}  # { sentry_issue_id: github_issue_number }

# Fetch unresolved Sentry issues (last 24h, sorted by last seen)
try:
    req = urllib.request.Request(
        f"https://sentry.io/api/0/projects/{sentry_org}/{sentry_proj}/issues/?query=is:unresolved&sort=date&limit=10",
        headers={"Authorization": f"Bearer {sentry_token}"}
    )
    sentry_issues = json.loads(urllib.request.urlopen(req, timeout=15, context=ssl_ctx).read())
except Exception as e:
    print(f"⚠️  Sentry sync skipped: {e}")
    sentry_issues = []

new_count = 0
for si in sentry_issues:
    sid = str(si["id"])
    if sid in tracked:
        continue  # Already have a GH issue for this

    title = si.get("title", "Unknown error")
    culprit = si.get("culprit", "")
    count = si.get("count", "?")
    users = si.get("userCount", "?")
    first_seen = si.get("firstSeen", "")
    last_seen = si.get("lastSeen", "")
    level = si.get("level", "error")
    permalink = si.get("permalink", "")

    # Create GitHub issue with Sentry context
    gh_title = f"[Sentry {level.upper()}] {title}"
    gh_body = f"""**Sentry Error Report** (auto-created by pipeline)

**Error:** {title}
**Location:** {culprit}
**Level:** {level}
**Events:** {count} | **Users affected:** {users}
**First seen:** {first_seen}
**Last seen:** {last_seen}
**Sentry link:** {permalink}
**Sentry ID:** {sid}

---
_This issue was auto-created from a Sentry error report. Fix the root cause and the Sentry issue will be auto-resolved on deploy._"""

    try:
        data = json.dumps({
            "title": gh_title,
            "body": gh_body,
            "labels": ["sentry", "bug"]
        }).encode()
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/issues",
            data=data, method="POST",
            headers={"Authorization": f"Bearer {gh_token}", "Content-Type": "application/json"}
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=10, context=ssl_ctx).read())
        gh_num = resp["number"]
        tracked[sid] = gh_num
        new_count += 1
        print(f"  🐛 Created GH issue #{gh_num} from Sentry error: {title}")

        # Add directly to pending queue so triage picks it up THIS run
        try:
            queue = json.load(open(queue_path))
        except:
            queue = []
        existing_nums = {i["number"] for i in queue}
        if gh_num not in existing_nums:
            queue.append({
                "number": gh_num,
                "title": gh_title,
                "body": gh_body,
                "labels": ["sentry", "bug"],
                "url": resp.get("html_url", ""),
                "created_at": resp.get("created_at", ""),
                "status": "pending",
                "source": "sentry",
                "sentry_id": sid
            })
            json.dump(queue, open(queue_path, "w"), indent=2)
            print(f"  📥 Added #{gh_num} to pending queue")
    except Exception as e:
        print(f"  ⚠️ Failed to create GH issue for Sentry {sid}: {e}")

if new_count:
    json.dump(tracked, open(tracker_path, "w"), indent=2)
    print(f"📥 Created {new_count} GitHub issue(s) from Sentry errors")
else:
    print("✅ No new Sentry errors to process")
SENTRY_EOF
else
  echo "ℹ️  Sentry sync skipped (SENTRY_AUTH_TOKEN/ORG/PROJECT not set)"
fi

# ─── Early exit if nothing to do ───
# Check: any pending/triaged issues to process? Any completed issues to deploy?
# If neither, exit immediately (this runs every 60s, so no need to waste cycles)
HAS_WORK=$(python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  actionable = [i for i in q if i.get('status') in ('pending','triaged','implemented','infra_implemented','documented','analyzed','rejected','failed')]
  print(len(actionable))
except: print(0)
" 2>/dev/null || echo 0)

UNPUSHED_COUNT=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')

if [ "$HAS_WORK" -eq 0 ] && [ "$UNPUSHED_COUNT" -eq 0 ]; then
  echo "😴 Nothing to do — no issues and no unpushed commits. Exiting."
  exit 0
fi

echo "📋 Work found: $HAS_WORK actionable issue(s), $UNPUSHED_COUNT unpushed commit(s)"

# ─── Reset stale in_progress issues ───
# Pipeline.sh is the sole orchestrator now. Any issues stuck at "in_progress" are stale
# (from dead workers). Reset them to "triaged" so Claude processes new issues instead of
# wasting every run on stale recovery.
STALE_RESET=$(python3 -c "
import json
path = '$QUEUE_FILE'
try:
  q = json.load(open(path))
  reset = 0
  for i in q:
    if i.get('status') == 'in_progress':
      i['status'] = 'triaged'
      reset += 1
  if reset:
    json.dump(q, open(path, 'w'), indent=2)
  print(reset)
except: print(0)
" 2>/dev/null || echo 0)

if [ "$STALE_RESET" -gt 0 ]; then
  echo "🔧 Reset $STALE_RESET stale in_progress issue(s) → triaged"
fi

# ═══════════════════════════════════════════════════════════════
#  Process pending issues with Claude CLI (one at a time)
#  Replaces the separate Claude Desktop scheduled worker.
#  Flow: triage one issue → implement → commit → deploy → repeat
# ═══════════════════════════════════════════════════════════════

MAX_ISSUES_PER_RUN=5
CLAUDE_TIMEOUT=600  # 10 minutes per issue max
DEPLOY_PUSHED_SHA=""
ISSUES_PROCESSED=0

# Find claude CLI (LaunchAgents have minimal PATH)
CLAUDE_BIN=""
for p in /usr/local/bin/claude /opt/homebrew/bin/claude "$HOME/.npm-global/bin/claude" "$HOME/.local/bin/claude"; do
  if [ -x "$p" ]; then CLAUDE_BIN="$p"; break; fi
done
# Also check PATH as fallback
if [ -z "$CLAUDE_BIN" ] && command -v claude &>/dev/null; then
  CLAUDE_BIN=$(command -v claude)
fi

if [ -n "$CLAUDE_BIN" ]; then
  echo "🤖 Claude CLI found at $CLAUDE_BIN — processing pending issues..."

  # Persistent log: append all Claude runs (not overwritten like the per-issue log)
  CLAUDE_HISTORY_LOG="$BOT_DIR/claude-history.log"

  while [ $ISSUES_PROCESSED -lt $MAX_ISSUES_PER_RUN ]; do
    # Get next pending/triaged issue details
    NEXT_ISSUE=$(python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('status') in ('pending', 'triaged'):
      route = i.get('route', 'pending')
      print(f'{i[\"number\"]}|{i[\"title\"]}|{i[\"status\"]}|{route}')
      break
except: pass
" 2>/dev/null)

    if [ -z "$NEXT_ISSUE" ]; then
      echo "✅ No more pending/triaged issues to process"
      break
    fi

    ISSUE_NUM=$(echo "$NEXT_ISSUE" | cut -d'|' -f1)
    ISSUE_TITLE=$(echo "$NEXT_ISSUE" | cut -d'|' -f2)
    ISSUE_STATUS=$(echo "$NEXT_ISSUE" | cut -d'|' -f3)
    ISSUE_ROUTE=$(echo "$NEXT_ISSUE" | cut -d'|' -f4)

    ISSUES_PROCESSED=$((ISSUES_PROCESSED + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Issue $ISSUES_PROCESSED/$MAX_ISSUES_PER_RUN: #$ISSUE_NUM — $ISSUE_TITLE"
    echo "  Status: $ISSUE_STATUS | Route: $ISSUE_ROUTE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Call Claude CLI to triage and implement ONE issue
    CLAUDE_LOG="$BOT_DIR/claude-issue.log"
    CLAUDE_START=$(date '+%Y-%m-%d %H:%M:%S')
    echo "  ⏱️  Started: $CLAUDE_START"

    # Run claude with timeout (macOS doesn't have GNU timeout, use background + wait)
    # --dangerously-skip-permissions: required for non-interactive mode to allow file edits
    "$CLAUDE_BIN" --dangerously-skip-permissions -p "You are the BabyBloom autonomous pipeline agent running natively on macOS.

REPO_DIR=$REPO_DIR

## Instructions

1. Read and follow $REPO_DIR/bot/TRIAGE_SKILL.md
2. SKIP the run-lock step (Step 0b) — pipeline.sh handles serialization
3. SKIP stale recovery — pipeline.sh already reset any in_progress issues to triaged
4. Process ONLY issue #$ISSUE_NUM (status=$ISSUE_STATUS):
   - If status=pending: triage it (classify, enrich), then dispatch to the appropriate specialist
   - If status=triaged: dispatch directly to the appropriate specialist
5. After the specialist agent completes this ONE issue (committed, analyzed, or documented), STOP
6. Do NOT process additional issues — pipeline.sh will call you again for the next one

## Environment
- You are running natively on macOS (not in a sandbox)
- All filesystem operations work normally (rm, mv, cp are fine)
- node_modules are macOS-native (no esbuild workaround needed)
- Use REPO_DIR=$REPO_DIR for all file paths
" > "$CLAUDE_LOG" 2>&1 &
    CLAUDE_PID=$!

    # Wait with timeout (macOS-compatible)
    SECONDS_WAITED=0
    while kill -0 "$CLAUDE_PID" 2>/dev/null; do
      sleep 5
      SECONDS_WAITED=$((SECONDS_WAITED + 5))
      if [ $SECONDS_WAITED -ge $CLAUDE_TIMEOUT ]; then
        echo "  ⏰ Claude timed out after ${CLAUDE_TIMEOUT}s — killing"
        kill "$CLAUDE_PID" 2>/dev/null
        sleep 2
        kill -9 "$CLAUDE_PID" 2>/dev/null
        break
      fi
    done
    wait "$CLAUDE_PID" 2>/dev/null
    CLAUDE_EXIT=$?
    CLAUDE_END=$(date '+%Y-%m-%d %H:%M:%S')

    # If Claude failed (non-zero exit), mark the issue as failed to prevent infinite retry
    if [ $CLAUDE_EXIT -ne 0 ]; then
      echo "  ⚠️  Claude failed (exit $CLAUDE_EXIT) — marking #$ISSUE_NUM as failed to prevent retry loop"
      python3 -c "
import json
path = '$QUEUE_FILE'
q = json.load(open(path))
for i in q:
    if i.get('number') == $ISSUE_NUM:
        i['status'] = 'failed'
        i['failure_reason'] = 'Claude CLI exited with code $CLAUDE_EXIT. Check $BOT_DIR/claude-issue.log for details.'
        break
json.dump(q, open(path, 'w'), indent=2)
print('Marked #$ISSUE_NUM as failed')
" 2>/dev/null
    fi

    # Check what status the issue ended up in after Claude processed it
    ISSUE_RESULT=$(python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  for i in q:
    if i.get('number') == $ISSUE_NUM:
      status = i.get('status', 'unknown')
      route = i.get('route', '-')
      notes = (i.get('implementation_notes') or i.get('skip_reason') or i.get('rejection_reason') or i.get('failure_reason') or '')[:200]
      print(f'{status}|{route}|{notes}')
      break
except: pass
" 2>/dev/null)

    RESULT_STATUS=$(echo "$ISSUE_RESULT" | cut -d'|' -f1)
    RESULT_ROUTE=$(echo "$ISSUE_RESULT" | cut -d'|' -f2)
    RESULT_NOTES=$(echo "$ISSUE_RESULT" | cut -d'|' -f3-)

    # Check for new git commits
    NEW_COMMIT=$(git log -1 --oneline 2>/dev/null | head -1)

    # Log summary
    echo "  ⏱️  Finished: $CLAUDE_END (exit code: $CLAUDE_EXIT)"
    echo "  📋 Result: #$ISSUE_NUM → $RESULT_STATUS (route: $RESULT_ROUTE)"
    [ -n "$RESULT_NOTES" ] && echo "  📝 Notes: $RESULT_NOTES"

    # Show key lines from Claude output (git commits, test results, errors)
    echo "  ─── Claude highlights ───"
    grep -iE "(commit|✅|❌|⚠️|test|passed|failed|error|implemented|analyzed|documented|triaged|rejected|skipped)" "$CLAUDE_LOG" 2>/dev/null | tail -15 | while IFS= read -r line; do echo "  $line"; done
    echo "  ─── end highlights ───"

    if [ $CLAUDE_EXIT -ne 0 ]; then
      echo "  ⚠️  Claude CLI exited with code $CLAUDE_EXIT (timeout=$CLAUDE_TIMEOUT)"
    fi

    # Append to history log
    echo "" >> "$CLAUDE_HISTORY_LOG"
    echo "═══ $(date) ═══ #$ISSUE_NUM: $ISSUE_TITLE" >> "$CLAUDE_HISTORY_LOG"
    echo "Route: $RESULT_ROUTE | Result: $RESULT_STATUS | Exit: $CLAUDE_EXIT" >> "$CLAUDE_HISTORY_LOG"
    [ -n "$RESULT_NOTES" ] && echo "Notes: $RESULT_NOTES" >> "$CLAUDE_HISTORY_LOG"
    echo "Duration: $CLAUDE_START → $CLAUDE_END" >> "$CLAUDE_HISTORY_LOG"

    # Deploy after each issue if there are committed changes
    UNPUSHED_NOW=$(git log origin/main..HEAD --oneline 2>/dev/null)
    UNCOMMITTED=$(git status --porcelain | grep -v '^??' 2>/dev/null)
    if [ -n "$UNCOMMITTED" ] || [ -n "$UNPUSHED_NOW" ]; then
      echo "  📦 Changes detected — deploying..."
      rm -f "$BOT_DIR/.deploy_env"
      bash "$BOT_DIR/deploy.sh"
      if [ -f "$BOT_DIR/.deploy_env" ]; then
        source "$BOT_DIR/.deploy_env"
        rm -f "$BOT_DIR/.deploy_env"
      fi
      if [ -n "$DEPLOY_PUSHED_SHA" ]; then
        echo "  📌 Deployed: $DEPLOY_PUSHED_SHA"
      fi
    else
      echo "  ℹ️  No code changes — nothing to deploy (issue may be analysis/docs/skip)"
    fi
  done

  # Run summary
  if [ $ISSUES_PROCESSED -gt 0 ]; then
    echo ""
    echo "🤖 ═══ Claude Run Summary: $ISSUES_PROCESSED issue(s) ═══"
    python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  # Show all non-pending issues (recently processed)
  for i in q:
    s = i.get('status','?')
    if s != 'pending':
      r = i.get('route','-')
      print(f'  #{i[\"number\"]:>4} | {s:<20} | {r:<15} | {i.get(\"title\",\"\")}')
except: pass
" 2>/dev/null
    echo "═══════════════════════════════════════════════════════════"
  fi
else
  echo "⚠️  claude CLI not found — skipping issue processing (install with: npm install -g @anthropic-ai/claude-code)"
fi

# ─── NOTE: We deliberately do NOT deploy uncommitted changes here. ───
# Only Claude-committed changes (from the loop above) get deployed.
# Random uncommitted edits (manual, IDE auto-save, etc.) stay uncommitted
# until a human or Claude explicitly commits them as part of an issue.

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

    # Create sub-issues from confirmed findings (auto-actionable items)
    SUB_CREATED=$(python3 -c "
import urllib.request, json, ssl
try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()

path = '$QUEUE_FILE'
q = json.load(open(path))
issue = None
for i in q:
    if i.get('number') == $num:
        issue = i
        break

findings = issue.get('confirmed_findings', []) if issue else []
created = 0
for f in findings:
    title = f.get('title', '').strip()
    body = f.get('body', '').strip()
    labels = f.get('labels', ['analysis-finding'])
    if not title:
        continue

    # Prefix with parent issue reference
    full_body = f'**From analysis of #{$num}**\n\n{body}'
    data = json.dumps({'title': title, 'body': full_body, 'labels': labels}).encode()
    try:
        req = urllib.request.Request(
            'https://api.github.com/repos/$REPO/issues',
            data=data, method='POST',
            headers={'Authorization': 'Bearer $GITHUB_TOKEN', 'Content-Type': 'application/json'}
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=10, context=ctx).read())
        gh_num = resp['number']
        created += 1
        print(f'  📌 Created sub-issue #{gh_num}: {title}')

        # Add to pending queue for immediate pickup
        existing_nums = {i['number'] for i in q}
        if gh_num not in existing_nums:
            q.append({
                'number': gh_num,
                'title': title,
                'body': full_body,
                'labels': labels,
                'url': resp.get('html_url', ''),
                'created_at': resp.get('created_at', ''),
                'status': 'pending',
                'source': 'analysis',
                'parent_issue': $num
            })
    except Exception as e:
        print(f'  ⚠️ Failed to create sub-issue: {e}')

if created:
    json.dump(q, open(path, 'w'), indent=2)
print(created)
" 2>/dev/null)

    send_telegram "🔍 *BabyBloom: Analysis Complete*

🔢 Issue: #$num
📌 Title: $title
$([ -n "$SUB_CREATED" ] && [ "$SUB_CREATED" -gt 0 ] 2>/dev/null && echo "🔧 Created $SUB_CREATED sub-issue(s) for confirmed findings")

Claude has posted findings as a comment on the GitHub issue.
🔗 [View analysis](https://github.com/$REPO/issues/$num)"

    echo "🔍 Analysis posted: #$num — $title"
    [ -n "$SUB_CREATED" ] && [ "$SUB_CREATED" -gt 0 ] 2>/dev/null && echo "  🔧 Created $SUB_CREATED sub-issue(s) from confirmed findings"
  done <<< "$ANALYZED"

  # Remove analyzed issues from queue (but keep any newly created sub-issues)
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

  # ─── CI gate for push-only path ───────────────────────────────
  # These commits bypassed deploy.sh (already committed externally).
  # If any src/ changes are present, run CI before pushing so we
  # never ship broken code directly to GitHub Actions.
  SRC_CHANGED=$(git diff origin/main..HEAD --name-only 2>/dev/null | grep -c '^src/' || true)
  if [ "$SRC_CHANGED" -gt 0 ]; then
    echo "🧪 src/ changes detected in unpushed commits ($SRC_CHANGED file(s)) — running CI..."
    bash "$BOT_DIR/ci.sh" "$REPO_DIR" || {
      send_telegram "🚨 *BabyBloom BLOCKER:* Local CI failed before push (push-only path) — deploy aborted."
      exit 1
    }
  else
    echo "ℹ️  No src/ changes — skipping CI for push-only commits"
  fi

  # ─── Sync with remote before pushing (handle divergence) ───
  echo "📥 Fetching remote..."
  git fetch origin main 2>&1 || true

  # Check if remote is ahead — rebase local commits on top
  REMOTE_AHEAD=$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REMOTE_AHEAD" -gt 0 ]; then
    echo "🔀 Remote is $REMOTE_AHEAD commit(s) ahead — rebasing local changes..."
    if ! git rebase origin/main 2>&1; then
      echo "⚠️  Rebase conflict — aborting rebase and notifying"
      git rebase --abort 2>/dev/null
      send_telegram "🚨 *BabyBloom Deploy BLOCKED*

📦 Local commits could not be rebased onto remote.
💥 Reason: merge conflict during rebase
🔧 Action needed: manual conflict resolution

🔗 [View repo](https://github.com/$REPO)"
      exit 1
    fi
    echo "✅ Rebase successful"
    COMMIT_SHA=$(git rev-parse --short HEAD)
  fi

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
  echo "ℹ️  Nothing to push — skipping CI wait and deploy notification."
fi

# ─── Everything below only runs if something was actually pushed ───
if [ -z "$COMMIT_SHA" ]; then
  echo "✅ Pipeline complete — nothing was pushed this run."
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

  # ─── Auto-close any open deploy-failure issues ───
  python3 - <<CLOSE_FAIL_EOF
import urllib.request, json, ssl

try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()

token = "$GITHUB_TOKEN"
repo  = "$REPO"
sha   = "$COMMIT_SHA"

try:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues?state=open&labels=deploy-failure&per_page=10",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    issues = json.loads(urllib.request.urlopen(req, timeout=10, context=ctx).read())
    for issue in issues:
        num = issue["number"]
        # Comment that it's fixed
        comment = json.dumps({"body": f"✅ Resolved — deploy succeeded on [\`{sha}\`](https://github.com/{repo}/commit/{sha})."}).encode()
        req2 = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/issues/{num}/comments",
            data=comment, method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        )
        urllib.request.urlopen(req2, timeout=10, context=ctx)
        # Close it
        close = json.dumps({"state": "closed", "state_reason": "completed"}).encode()
        req3 = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/issues/{num}",
            data=close, method="PATCH",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        )
        urllib.request.urlopen(req3, timeout=10, context=ctx)
        print(f"  ✅ Auto-closed deploy-failure issue #{num}")
except Exception as e:
    print(f"  ℹ️ Deploy-failure cleanup: {e}")
CLOSE_FAIL_EOF
elif [ "$ACTIONS_STATUS" = "failure" ]; then
  STATUS_LINE="❌ *Build & Deploy: FAILED*"
  LIVE_LINE="🔗 [View failed run]($RUN_URL)"

  # ─── Auto-create GitHub issue with failure details ───
  echo "📝 Creating GitHub issue for deployment failure..."
  FAILED_STEP="unknown"
  FAILURE_LOG=""

  # Fetch failed job details from the Actions run
  if [ -n "$RUN_URL" ]; then
    RUN_ID=$(echo "$RUN_URL" | grep -o '[0-9]*$')
    if [ -n "$RUN_ID" ]; then
      FAILURE_LOG=$(python3 - <<FAIL_EOF
import urllib.request, json, ssl, sys

try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()

token = "$GITHUB_TOKEN"
repo  = "$REPO"
run_id = "$RUN_ID"

# Get jobs for this run
try:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/jobs",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    data = json.loads(urllib.request.urlopen(req, timeout=15, context=ctx).read())
    jobs = data.get("jobs", [])

    parts = []
    for job in jobs:
        if job.get("conclusion") == "failure":
            parts.append(f"**Job:** {job['name']} — FAILED")
            for step in job.get("steps", []):
                if step.get("conclusion") == "failure":
                    parts.append(f"**Failed step:** {step['name']}")
                    print(step['name'], file=sys.stderr)

    # Get failed step log annotations
    req2 = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/annotations",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    )
    try:
        annots = json.loads(urllib.request.urlopen(req2, timeout=15, context=ctx).read())
        for a in annots[:10]:
            if a.get("annotation_level") in ("failure", "error"):
                msg = a.get("message", "")[:500]
                parts.append(f"**Error:** {msg}")
    except:
        pass

    print("\\n".join(parts) if parts else "Could not determine failed step")
except Exception as e:
    print(f"Could not fetch failure details: {e}")
FAIL_EOF
)
      FAILED_STEP=$(echo "$FAILURE_LOG" 2>&1 | head -1)
    fi
  fi

  # Also include recent commit messages for context
  RECENT_COMMITS=$(git log --oneline -5 2>/dev/null | sed 's/"/\\"/g')

  python3 - <<ISSUE_EOF
import urllib.request, json, ssl

try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()

token = "$GITHUB_TOKEN"
repo  = "$REPO"
sha   = "$COMMIT_SHA"
run_url = "$RUN_URL"
failure_log = """$FAILURE_LOG"""
recent_commits = """$RECENT_COMMITS"""

body = f"""**Deployment failed** (auto-created by pipeline)

**Commit:** [\`{sha}\`](https://github.com/{repo}/commit/{sha})
**Time:** $(date '+%Y-%m-%d %H:%M %Z')
**Actions run:** {run_url}

## Failure Details

{failure_log if failure_log.strip() else "_Could not retrieve failure details — check the Actions run link above._"}

## Recent Commits

\`\`\`
{recent_commits}
\`\`\`

## Next Steps

1. Check the [failed Actions run]({run_url}) for full logs
2. Fix the issue locally and push
3. Pipeline will auto-close this issue on next successful deploy

---
_Auto-created by BabyBloom pipeline on deploy failure._"""

try:
    data = json.dumps({
        "title": f"[Deploy Failed] Build failure on {sha}",
        "body": body,
        "labels": ["deploy-failure", "bug"]
    }).encode()
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues",
        data=data, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=10, context=ctx).read())
    print(f"📝 Created deploy failure issue #{resp['number']}: {resp['html_url']}")
except Exception as e:
    print(f"⚠️ Could not create failure issue: {e}")
ISSUE_EOF

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

# ─── Auto-resolve Sentry issues that were fixed in this deploy ───
if [ "$ACTIONS_STATUS" = "success" ] && [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then
  python3 - <<RESOLVE_EOF
import json, urllib.request, ssl

try:
    import certifi; ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context(); ctx.load_default_certs()

tracker_path = "$BOT_DIR/sentry-tracked.json"
queue_path   = "$QUEUE_FILE"
sentry_token = "$SENTRY_AUTH_TOKEN"
sentry_org   = "$SENTRY_ORG"
sentry_proj  = "$SENTRY_PROJECT"

try:
    tracked = json.load(open(tracker_path))
except:
    tracked = {}

# Find which GH issues were just closed (implemented)
try:
    queue = json.load(open(queue_path))
except:
    queue = []

done_statuses = {"implemented", "infra_implemented", "documented"}
closed_nums = {str(i["number"]) for i in queue if i.get("status") in done_statuses}

resolved_sentry = []
for sid, gh_num in list(tracked.items()):
    if str(gh_num) in closed_nums:
        # Resolve this Sentry issue
        try:
            data = json.dumps({"status": "resolved"}).encode()
            req = urllib.request.Request(
                f"https://sentry.io/api/0/issues/{sid}/",
                data=data, method="PUT",
                headers={"Authorization": f"Bearer {sentry_token}", "Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=10, context=ctx)
            resolved_sentry.append(sid)
            del tracked[sid]
            print(f"  ✅ Resolved Sentry issue {sid} (GH #{gh_num})")
        except Exception as e:
            print(f"  ⚠️ Could not resolve Sentry {sid}: {e}")

if resolved_sentry:
    json.dump(tracked, open(tracker_path, "w"), indent=2)
    print(f"🎯 Resolved {len(resolved_sentry)} Sentry issue(s)")
RESOLVE_EOF
fi

send_telegram "$MSG"
echo "🎉 Pipeline complete! Telegram notified with CI result: $ACTIONS_STATUS"
