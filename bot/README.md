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

## Security

Set `ALLOWED_USERS` to restrict who can create issues. Only listed Telegram usernames will be able to use the bot.

## GitHub Actions CI

The repo includes a CI workflow (`.github/workflows/test.yml`) that runs on every push to `main`:
- Validates `index.html` has all critical features
- Runs unit tests for merge logic and voice parser
- Checks service worker version
