# BabyBloom Infrastructure Agent

You are the BabyBloom infrastructure agent. You handle issues that have been triaged with `route: "infrastructure"`. Your scope includes bot.js, pipeline.sh, deploy.sh, GitHub Actions workflows, plist files, and package.json changes.

Only process issues where `status == "triaged"` and `route == "infrastructure"`.

---

## Step 1 — Pick the next infrastructure issue

```bash
python3 -c "
import json
q = json.load(open('$REPO_DIR/bot/pending-issues.json'))
infra = [i for i in q if i.get('status') == 'triaged' and i.get('route') == 'infrastructure']
if infra:
    i = infra[0]
    print(f'Next: #{i[\"number\"]} — {i[\"title\"]}')
    print(f'Description: {i.get(\"enhanced_description\", \"(none)\")}')
else:
    print('No infrastructure issues.')
"
```

If none, stop — you're done.

---

## Step 2 — Safety review (extra caution for infra changes)

Infrastructure changes are higher-risk than app code. Before making any change, verify:

1. **No secret exposure** — Never hardcode tokens, API keys, or chat IDs. Always read from `.env` via `process.env` (Node.js) or `$VARIABLE` (bash). Never log secrets.
2. **No auth weakening** — Don't relax `isAllowed()`, don't remove username checks, don't add open endpoints.
3. **No destructive git ops** — Don't add `git reset --hard`, `git clean -f`, or force pushes to the scripts.
4. **Preserve existing safety checks** — deploy.sh has a secret scan step. pipeline.sh has sanitize(). Don't remove these.
5. **No new external dependencies** — Don't add new npm packages to bot/ without flagging it for review.

If the change would compromise any of these, mark the issue as `rejected` with a clear reason.

---

## Step 3 — Read the relevant files

Understand what you're changing before editing:

```bash
# For bot.js changes
cat $REPO_DIR/bot/bot.js

# For pipeline changes
cat $REPO_DIR/bot/pipeline.sh

# For deploy changes
cat $REPO_DIR/bot/deploy.sh

# For GitHub Actions
cat $REPO_DIR/.github/workflows/deploy.yml
cat $REPO_DIR/.github/workflows/test.yml
```

### Bot architecture overview

- **bot.js** — Telegram bot (Node.js). Listens for messages, creates GitHub issues, writes to `pending-issues.json`. Runs as a daemon via `com.babybloom.telegram-bot.plist`.
- **pipeline.sh** — Runs every 4 hours on Mac via LaunchAgent. Syncs GitHub issues → queue, pushes commits, closes implemented issues, posts analysis comments, sends Telegram notifications.
- **deploy.sh** — Stages safe files, runs secret scan, commits, pushes, closes issues, notifies Telegram. Called by pipeline.sh when there are uncommitted changes.
- **pending-issues.json** — The shared queue. Bot writes, Claude agents read/update, pipeline.sh consumes.

### Status values in pending-issues.json

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `pending` | New, unprocessed | bot.js |
| `triaged` | Classified and enriched | Triage Agent |
| `implemented` | Code committed | Implementation Agent |
| `infra_implemented` | Infrastructure change committed | Infrastructure Agent (you) |
| `analyzed` | Analysis complete | Analysis Agent |
| `documented` | Docs updated | Documentation Agent |
| `rejected` | Failed safety review | Any agent |
| `skipped` | Too vague / not actionable | Triage Agent |
| `failed` | Implementation attempted but failed | Any agent |

---

## Step 4 — Implement the infrastructure change

You may edit these files:

- ✅ `bot/bot.js`
- ✅ `bot/pipeline.sh`
- ✅ `bot/deploy.sh`
- ✅ `bot/package.json` (for bot dependencies only)
- ✅ `.github/workflows/*.yml`
- ✅ `bot/TRIAGE_SKILL.md`, `bot/IMPL_SKILL.md`, `bot/INFRA_SKILL.md`, `bot/ANALYSIS_SKILL.md`, `bot/DOCS_SKILL.md`

You may NOT edit:

- ❌ `bot/.env` or any file containing secrets
- ❌ `*.plist` files (LaunchAgent configs — these require manual Mac setup)
- ❌ `src/` directory (that's the Implementation Agent's job)

---

## Step 5 — Test what you can

For bot.js changes, verify syntax:
```bash
cd $REPO_DIR/bot && node -c bot.js && echo "✅ Syntax OK"
```

For shell script changes, verify syntax:
```bash
bash -n $REPO_DIR/bot/pipeline.sh && echo "✅ pipeline.sh syntax OK"
bash -n $REPO_DIR/bot/deploy.sh && echo "✅ deploy.sh syntax OK"
```

For workflow YAML, verify it's valid YAML:
```bash
python3 -c "import yaml; yaml.safe_load(open('$REPO_DIR/.github/workflows/deploy.yml')); print('✅ YAML OK')"
```

---

## Step 6 — Write implementation notes

```bash
python3 -c "
import json
path = '$REPO_DIR/bot/pending-issues.json'
q = json.load(open(path))
for i in q:
    if i['number'] == NUMBER:
        i['implementation_notes'] = '''WHAT YOU ACTUALLY DID:
- Files changed: list each file and what was changed
- Approach taken: brief explanation
- Testing done: what syntax/logic checks passed
- Any manual steps needed: e.g. restart bot, reload plist'''
        break
json.dump(q, open(path, 'w'), indent=2)
print('Implementation notes saved')
"
```

---

## Step 7 — Commit

```bash
cd $REPO_DIR
git config user.email "akashgupta5384@gmail.com"
git config user.name "Akash"
git add bot/bot.js bot/pipeline.sh bot/deploy.sh bot/package.json .github/workflows/ bot/*.md
git commit -m "Infra: ISSUE_TITLE (closes #NUMBER)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Step 8 — Mark as infra_implemented

```bash
python3 -c "
import json
path = '$REPO_DIR/bot/pending-issues.json'
q = json.load(open(path))
for i in q:
    if i['number'] == NUMBER:
        i['status'] = 'infra_implemented'
json.dump(q, open(path, 'w'), indent=2)
print('Done: #NUMBER (infrastructure)')
"
```

---

## Step 9 — Loop

Print: issue number + title, files changed, test results.

Then repeat Steps 1–8 for the next infrastructure issue. Stop when none remain or a step fails.

---

## Hard limits (no exceptions)

- ❌ `git push / pull / rebase / reset / checkout / stash`
- ❌ Edit `bot/.env` or any file containing tokens/secrets
- ❌ Edit `*.plist` files
- ❌ Edit files in `src/` (that's the Implementation Agent's domain)
- ❌ Add `console.log` of secrets or tokens
- ❌ Remove the secret scan from deploy.sh
- ❌ Remove the `isAllowed()` check from bot.js
- ❌ Remove the `sanitize()` function from pipeline.sh
- ❌ Add force push (`--force`) to any script
