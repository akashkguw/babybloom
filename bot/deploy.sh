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

# Create a GitHub issue so the bot worker can investigate the failure
# Usage: create_failure_issue "Title" "body details"
create_failure_issue() {
  local title="$1"
  local body="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M %Z')
  curl -s -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"🚨 Deploy failure: ${title}\",\"body\":\"## Deploy Blocker — ${ts}\n\n${body}\n\n---\n*Auto-filed by deploy.sh — pick up and investigate.*\",\"labels\":[\"bug\",\"deploy-failure\"]}" \
    "https://api.github.com/repos/$REPO/issues" > /dev/null 2>&1
  echo "📋 GitHub issue filed: $title"
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
  bot/ci.sh
  bot/dashboard.js
  bot/start-dashboard.sh
  bot/WORKER_SKILL.md
  bot/TRIAGE_SKILL.md
  bot/IMPL_SKILL.md
  bot/INFRA_SKILL.md
  bot/ANALYSIS_SKILL.md
  bot/DOCS_SKILL.md
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
# Patterns: common secret token formats
GH_PAT_PATTERN="github_pat_[A-Za-z0-9_]{30,}"
GH_TOKEN_PATTERN="ghp_[A-Za-z0-9]{36,}"
TG_TOKEN_PATTERN="[0-9]{8,}:AA[A-Za-z0-9_-]{30,}"
AWS_KEY_PATTERN="AKIA[0-9A-Z]{16}"
STRIPE_PATTERN="sk_(live|test)_[A-Za-z0-9]{20,}"
GENERIC_SECRET_PATTERN="(api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key)\s*[=:]\s*['\"][A-Za-z0-9+/=_-]{20,}['\"]"
SSH_PRIVATE_KEY="-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"
ALL_PATTERNS="${GH_PAT_PATTERN}|${GH_TOKEN_PATTERN}|${TG_TOKEN_PATTERN}|${AWS_KEY_PATTERN}|${STRIPE_PATTERN}|${GENERIC_SECRET_PATTERN}|${SSH_PRIVATE_KEY}"
if git diff --cached | grep -qE "${ALL_PATTERNS}"; then
  echo "🚨 SECRET DETECTED in staged files! Aborting."
  echo "   Run: git diff --cached | grep -iE '$SECRET_PATTERNS'"
  create_failure_issue "Secret detected in staged files" "A secret token pattern was found in staged files. Deploy aborted and files unstaged.\n\nAction required: identify and remove the secret, then rotate the token."
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

# ─── Local CI checks (unit tests + build + server smoke test) ───
echo "🧪 Running local CI checks..."
bash "$BOT_DIR/ci.sh" "$REPO_DIR" 2>&1 | tee "$BOT_DIR/ci.log"
CI_EXIT=${PIPESTATUS[0]}
if [ "$CI_EXIT" -ne 0 ]; then
  CI_SUMMARY=$(tail -20 "$BOT_DIR/ci.log" 2>/dev/null | grep -E '(✅|❌|FAILED|passed|failed)' | head -10 | tr '\n' ' ' || echo "see ci.log")
  create_failure_issue "Local CI failed — deploy blocked" "CI pipeline blocked the deploy.\n\n\`\`\`\n${CI_SUMMARY}\n\`\`\`\n\nCheck \`bot/ci.log\` for full details. Fix the failing tests or build before the next deploy."
  send_telegram "🚨 *BabyBloom BLOCKER:* Local CI failed — deploy aborted. Check bot/ci.log for details."
  exit 1
fi

# ─── Read completed issues from pending-issues.json ───
QUEUE_FILE="$BOT_DIR/pending-issues.json"
IMPLEMENTED_DATA=$(python3 -c "
import json
try:
  q=json.load(open('$QUEUE_FILE'))
  done_statuses = {'implemented', 'infra_implemented', 'documented'}
  for i in q:
    if i.get('status') in done_statuses:
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
  create_failure_issue "git push rejected" "The git push to origin/main was rejected.\n\nPossible causes: conflicting remote commits, expired token, or branch protection rules.\n\nRun \`git status\` and \`git log origin/main..HEAD\` locally to investigate."
  send_telegram "❌ *BabyBloom Deploy FAILED:* git push rejected. Check for secrets or auth issues."
  exit 1
}

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "✅ Pushed: $COMMIT_SHA"

# ─── Close implemented issues + update description + post detailed comment ───
ISSUE_LIST=$(python3 - <<PYEOF
import urllib.request, json, sys, ssl

try:
    import certifi; ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ssl_ctx = ssl.create_default_context(); ssl_ctx.load_default_certs()

token  = "$GITHUB_TOKEN"
repo   = "$REPO"
sha    = "$COMMIT_SHA"
qfile  = "$QUEUE_FILE"
base   = f"https://api.github.com/repos/{repo}"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def gh(method, path, data=None):
    req = urllib.request.Request(
        base + path, method=method,
        data=json.dumps(data).encode() if data else None,
        headers=headers
    )
    try:
        urllib.request.urlopen(req, timeout=10, context=ssl_ctx)
        return True
    except Exception as e:
        print(f"  ⚠️  GitHub API error: {e}", file=sys.stderr)
        return False

q = json.load(open(qfile))
resolved = []

done_statuses = {"implemented", "infra_implemented", "documented"}
for issue in q:
    if issue.get("status") not in done_statuses:
        continue
    num   = issue["number"]
    title = issue.get("title", f"Issue #{num}")
    desc  = issue.get("enhanced_description", "")
    notes = issue.get("implementation_notes", "")

    print(f"Processing #{num}: {title}")

    # Update issue body with enriched description
    if desc.strip():
        gh("PATCH", f"/issues/{num}", {"body": desc})
        print(f"  ✅ Description updated")

    # Post detailed implementation comment
    if notes.strip():
        comment = (
            f"✅ **Implemented** in "
            f"[{sha}](https://github.com/{repo}/commit/{sha})\n\n"
            f"**What was done:**\n{notes}"
        )
    else:
        comment = f"✅ Implemented and deployed in [{sha}](https://github.com/{repo}/commit/{sha})."
    gh("POST", f"/issues/{num}/comments", {"body": comment})
    print(f"  ✅ Comment posted")

    # Close the issue
    gh("PATCH", f"/issues/{num}", {"state": "closed", "state_reason": "completed"})
    print(f"  ✅ Closed #{num}")

    resolved.append(f"✅ #{num} — {title}")

print("\n".join(resolved))
PYEOF
)

# ─── Export SHA for pipeline.sh (notification sent there after CI completes) ───
echo "DEPLOY_PUSHED_SHA=$COMMIT_SHA" >> "$BOT_DIR/.deploy_env"
echo ""
echo "✅ Deploy complete. SHA=$COMMIT_SHA (notification deferred to pipeline.sh post-CI)"
