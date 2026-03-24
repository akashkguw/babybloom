# BabyBloom Telegram Bot

Send feedback from Telegram → auto-creates GitHub Issues with smart labeling.

## Setup (5 minutes)

### Step 1: Create your Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Name it something like "BabyBloom Feedback"
4. Copy the **bot token** it gives you

### Step 2: Create a GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens?type=beta)
2. Click **"Generate new token"** (Fine-grained)
3. Give it a name like "BabyBloom Bot"
4. Under **Repository access**, select "Only select repositories" → pick `babybloom`
5. Under **Permissions → Repository permissions**, enable:
   - **Issues**: Read and write
6. Copy the token

### Step 3: Deploy (pick one)

#### Option A: Render (Free)

1. Go to [render.com](https://render.com) → New → Background Worker
2. Connect your GitHub repo
3. Set **Root Directory** to `bot`
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node bot.js`
6. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` = your bot token
   - `GITHUB_TOKEN` = your GitHub token
   - `GITHUB_REPO` = `akashkguw/babybloom`
   - `ALLOWED_USERS` = your Telegram username (e.g., `akashkg`)
7. Deploy!

#### Option B: Railway (Free tier)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `babybloom` repo
3. Set **Root Directory** to `/bot`
4. Add the same environment variables as above
5. Deploy!

#### Option C: Run locally

```bash
cd bot
npm install
cp .env.example .env
# Edit .env with your tokens
export $(cat .env | xargs) && node bot.js
```

## Usage

Once deployed, open your bot on Telegram and just send messages:

| You send | Bot creates |
|----------|-------------|
| "The feed timer doesn't stop when I switch tabs" | 🐛 Bug issue |
| "Add a growth comparison chart for twins" | ✨ Feature issue |
| "Dark mode text is hard to read on vaccines page" | 🎨 UI issue |
| Send a screenshot with caption | 📸 Issue with image |

### Commands

- `/start` — Welcome message
- `/bug <description>` — Report a bug
- `/feature <description>` — Request a feature
- `/status` — Open issue count
- `/recent` — Last 5 issues
- `/help` — Usage help

### Smart Labels

The bot auto-detects categories from your message:

| Detected topic | Label |
|----------------|-------|
| bug, broken, crash, not working | `bug` |
| feature, add, new, want | `enhancement` |
| UI, design, layout, color | `ui` |
| feed, breast, bottle | `feeding` |
| diaper, poop, pee | `diaper` |
| sleep, nap, wake | `sleep` |
| voice, siri, shortcut | `voice-input` |
| urgent, critical | `priority` |

All issues also get a `telegram` label so you can filter them.

## Multi-Agent Pipeline

Beyond the Telegram bot, BabyBloom includes a full automation pipeline that processes issues using specialized Claude agents:

```
Telegram message → bot.js → GitHub Issue ──┐
Sentry error → pipeline.sh → GitHub Issue ─┤
                                           ↓
                                    pipeline.sh → Triage Agent
                                                       ↓
                                     ┌─────────────┬───┴────────┬──────────────┐
                                     ↓             ↓            ↓              ↓
                               Implementation  Infrastructure  Analysis   Documentation
                                 (IMPL)          (INFRA)      (read-only)   (DOCS)
                                     ↓             ↓            ↓              ↓
                                  deploy.sh → push → close GH issue → resolve Sentry → Telegram
```

### Agent skills

| Agent | File | What it does |
|-------|------|-------------|
| Triage | `TRIAGE_SKILL.md` | Classifies issues, enriches descriptions, routes to specialist |
| Implementation | `IMPL_SKILL.md` | Code changes in `src/` and `tests/` only |
| Infrastructure | `INFRA_SKILL.md` | Pipeline, deploy, CI, bot.js changes |
| Analysis | `ANALYSIS_SKILL.md` | Read-only investigation, posts findings as comments |
| Documentation | `DOCS_SKILL.md` | Markdown and JSDoc updates |

### Pipeline scripts

| Script | Trigger | What it does |
|--------|---------|-------------|
| `pipeline.sh` | Mac LaunchAgent (every 30 min) | Syncs GitHub issues, dispatches to Claude agents |
| `deploy.sh` | Called by pipeline after implementation | Commits, pushes, closes issues, notifies via Telegram |

### Environment variables

All secrets are loaded from `bot/.env` (never hardcoded):

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `GITHUB_TOKEN` | Fine-grained PAT with Issues read/write |
| `GITHUB_REPO` | Repository in `owner/repo` format |
| `ALLOWED_USERS` | Comma-separated Telegram usernames |
| `TELEGRAM_CHAT_ID` | Chat ID for pipeline notifications |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking (injected at build time) |

## Security

- `ALLOWED_USERS` restricts who can create issues via Telegram
- `deploy.sh` runs a secret scan before every commit — hard stops if tokens are detected in staged files
- `.env` and `pending-issues.json` are gitignored
- GitHub PAT uses fine-grained permissions (Issues only)

## GitHub Actions CI

The repo includes CI workflows in `.github/workflows/`:
- `deploy.yml` — Type check → build → deploy to GitHub Pages (injects `VITE_SENTRY_DSN` from repository secrets)
- `test.yml` — Validates critical features, runs unit tests
