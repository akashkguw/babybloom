#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  BabyBloom Telegram Bot → GitHub Issues Pipeline
// ═══════════════════════════════════════════════════════════════
//
//  Send a message on Telegram, get a GitHub Issue created
//  with auto-labeling (feature, bug, content, ui, etc.)
//
//  ENV vars needed:
//    TELEGRAM_BOT_TOKEN  — from @BotFather
//    GITHUB_TOKEN        — Personal Access Token (repo scope)
//    GITHUB_REPO         — e.g. "akashkguw/babybloom"
//    ALLOWED_USERS       — comma-separated Telegram usernames (optional, for security)
//
// ═══════════════════════════════════════════════════════════════

// ─── Load .env file if present ───
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq > 0) process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  });
}

const TelegramBot = require("node-telegram-bot-api");
const { Octokit } = require("octokit");

// ─── Config ───
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "akashkguw/babybloom";
const ALLOWED_USERS = process.env.ALLOWED_USERS
  ? process.env.ALLOWED_USERS.split(",").map((u) => u.trim().toLowerCase())
  : [];

if (!TELEGRAM_TOKEN || !GITHUB_TOKEN) {
  console.error(
    "Missing env vars. Set TELEGRAM_BOT_TOKEN and GITHUB_TOKEN."
  );
  process.exit(1);
}

const [owner, repo] = GITHUB_REPO.split("/");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ─── Auto-labeling ───
const LABEL_RULES = [
  { pattern: /\b(bug|fix|broken|crash|error|wrong|not working|issue)\b/i, label: "bug", emoji: "🐛" },
  { pattern: /\b(feature|add|new|want|can you|should have|would be nice|idea)\b/i, label: "enhancement", emoji: "✨" },
  { pattern: /\b(ui|design|layout|color|font|button|screen|dark mode|theme|style)\b/i, label: "ui", emoji: "🎨" },
  { pattern: /\b(guide|info|content|text|tip|advice|best practices?|article)\b/i, label: "content", emoji: "📝" },
  { pattern: /\b(feed|breast|bottle|formula|solids|milk|nursing)\b/i, label: "feeding", emoji: "🍼" },
  { pattern: /\b(diaper|poop|pee|wet|dirty)\b/i, label: "diaper", emoji: "💧" },
  { pattern: /\b(sleep|nap|wake|bedtime|night)\b/i, label: "sleep", emoji: "😴" },
  { pattern: /\b(growth|weight|height|percentile|chart)\b/i, label: "growth", emoji: "📊" },
  { pattern: /\b(vaccines?|immunization|shot)\b/i, label: "health", emoji: "💉" },
  { pattern: /\b(massage|bath|temperature|fever|meds|medicine)\b/i, label: "health", emoji: "💜" },
  { pattern: /\b(voice|siri|shortcut|mic|speech)\b/i, label: "voice-input", emoji: "🎤" },
  { pattern: /\b(urgent|asap|critical|important)\b/i, label: "priority", emoji: "🔴" },
];

function detectLabels(text) {
  const labels = new Set();
  const emojis = [];
  for (const rule of LABEL_RULES) {
    if (rule.pattern.test(text)) {
      labels.add(rule.label);
      if (!emojis.includes(rule.emoji)) emojis.push(rule.emoji);
    }
  }
  // Default label
  if (labels.size === 0) labels.add("feedback");
  return { labels: [...labels], emojis };
}

// ─── Generate a concise title from the message ───
function generateTitle(text) {
  // First sentence or first 80 chars
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length <= 80) return firstSentence;
  return firstSentence.substring(0, 77) + "...";
}

// ─── Ensure labels exist on the repo ───
async function ensureLabels(labels) {
  for (const label of labels) {
    try {
      await octokit.rest.issues.getLabel({ owner, repo, name: label });
    } catch {
      const colors = {
        bug: "d73a4a", enhancement: "a2eeef", ui: "7057ff",
        content: "0075ca", feeding: "fbca04", diaper: "bfdadc",
        sleep: "d4c5f9", growth: "c5def5", health: "ff9f1c",
        "voice-input": "f9d0c4", priority: "b60205",
        feedback: "e4e669", telegram: "0088cc",
      };
      try {
        await octokit.rest.issues.createLabel({
          owner, repo,
          name: label,
          color: colors[label] || "ededed",
        });
      } catch { /* label might already exist in a race */ }
    }
  }
}

// ─── Auth check ───
function isAllowed(username) {
  if (ALLOWED_USERS.length === 0) return true;
  return ALLOWED_USERS.includes((username || "").toLowerCase());
}

// ─── Local issue queue (sandbox reads this — no network needed) ───
const QUEUE_PATH = path.join(__dirname, "pending-issues.json");

function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8")); }
  catch { return []; }
}

function writeQueue(items) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2));
}

function addToQueue(issue, labels) {
  const queue = readQueue();
  queue.push({
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels,
    url: issue.html_url,
    created_at: new Date().toISOString(),
    status: "pending",
  });
  writeQueue(queue);
}

// ─── Track pending issues for multi-message context ───
const pendingIssues = {};

// ═══════════════════════════════
//  /start — Welcome
// ═══════════════════════════════
bot.onText(/\/start/, (msg) => {
  if (!isAllowed(msg.from.username)) return;
  bot.sendMessage(
    msg.chat.id,
    `👋 *Welcome to BabyBloom Bot!*

Send me any feedback, feature request, or bug report and I'll create a GitHub Issue for it.

*Commands:*
/feedback — Send feedback (or just type your message)
/bug — Report a bug
/feature — Request a feature
/status — Check open issues
/help — Show this message

Just type naturally — I'll auto-detect whether it's a bug, feature request, or general feedback and label it accordingly.`,
    { parse_mode: "Markdown" }
  );
});

// ═══════════════════════════════
//  /chatid — show your chat ID
// ═══════════════════════════════
bot.onText(/\/chatid/, (msg) => {
  bot.sendMessage(msg.chat.id, `Your chat ID is: \`${msg.chat.id}\``, { parse_mode: "Markdown" });
});

// ═══════════════════════════════
//  /help
// ═══════════════════════════════
bot.onText(/\/help/, (msg) => {
  if (!isAllowed(msg.from.username)) return;
  bot.sendMessage(
    msg.chat.id,
    `📖 *BabyBloom Bot Help*

Just send me a message describing what you want, and I'll create a GitHub Issue.

*Examples:*
• "The feed timer doesn't stop when I switch tabs"
• "Add a growth comparison chart for twins"
• "The dark mode text is hard to read on the vaccine page"
• "Can you add a pumping log with oz tracking?"

*Smart labels:* I auto-detect the category (bug, feature, UI, feeding, sleep, etc.) from your message.

*Commands:*
/bug \`description\` — Shortcut for bug reports
/feature \`description\` — Shortcut for feature requests
/edit \`number\` \`new description\` — Update an existing issue
/status — See open issue count
/recent — See last 5 issues`,
    { parse_mode: "Markdown" }
  );
});

// ═══════════════════════════════
//  /edit <number> <new description>
// ═══════════════════════════════
bot.onText(/\/edit\s+(\d+)\s+(.+)/s, async (msg, match) => {
  if (!isAllowed(msg.from.username)) return;
  const issueNumber = parseInt(match[1]);
  const newText = match[2].trim();

  try {
    // Fetch existing issue to preserve labels
    const { data: existing } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });

    const { labels: autoLabels } = detectLabels(newText);
    const allLabels = [...new Set([...existing.labels.map(l => l.name), ...autoLabels, "telegram"])];
    const newTitle = generateTitle(newText);
    const newBody = buildIssueBody(newText, allLabels);

    await octokit.rest.issues.update({
      owner, repo,
      issue_number: issueNumber,
      title: newTitle,
      body: newBody,
      labels: allLabels,
    });

    // Add a comment noting the update
    await octokit.rest.issues.createComment({
      owner, repo,
      issue_number: issueNumber,
      body: `✏️ *Issue updated via Telegram*\n\n**New description:** ${newText}\n\n_Updated by @${msg.from.username || "user"} via BabyBloom Bot_`,
    });

    // Update in local queue if present
    try {
      const queue = readQueue();
      const entry = queue.find(i => i.number === issueNumber);
      if (entry) {
        entry.title = newTitle;
        entry.body = newBody;
        entry.status = "pending"; // re-open for implementation
        writeQueue(queue);
      }
    } catch {}

    bot.sendMessage(
      msg.chat.id,
      `✅ *Issue #${issueNumber} updated!*\n\n📌 ${newTitle}\n🔗 [View on GitHub](${existing.html_url})`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Failed to update issue #${issueNumber}: ${e.message}`);
  }
});

// ═══════════════════════════════
//  /bug <description>
// ═══════════════════════════════
bot.onText(/\/bug\s+(.+)/s, async (msg, match) => {
  if (!isAllowed(msg.from.username)) return;
  await createIssue(msg.chat.id, match[1], ["bug", "telegram"]);
});

// ═══════════════════════════════
//  /feature <description>
// ═══════════════════════════════
bot.onText(/\/feature\s+(.+)/s, async (msg, match) => {
  if (!isAllowed(msg.from.username)) return;
  await createIssue(msg.chat.id, match[1], ["enhancement", "telegram"]);
});

// ═══════════════════════════════
//  /status — Open issue count
// ═══════════════════════════════
bot.onText(/\/status/, async (msg) => {
  if (!isAllowed(msg.from.username)) return;
  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner, repo,
      state: "open",
      labels: "telegram",
      per_page: 1,
    });
    const totalOpen = data.length;

    const allOpen = await octokit.rest.issues.listForRepo({
      owner, repo,
      state: "open",
      labels: "telegram",
      per_page: 100,
    });

    bot.sendMessage(
      msg.chat.id,
      `📊 *BabyBloom Issue Status*\n\nOpen issues (from Telegram): *${allOpen.data.length}*\n\n[View on GitHub](https://github.com/${GITHUB_REPO}/issues?q=is%3Aopen+label%3Atelegram)`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, "❌ Couldn't fetch status: " + e.message);
  }
});

// ═══════════════════════════════
//  /recent — Last 5 issues
// ═══════════════════════════════
bot.onText(/\/recent/, async (msg) => {
  if (!isAllowed(msg.from.username)) return;
  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner, repo,
      labels: "telegram",
      sort: "created",
      direction: "desc",
      per_page: 5,
    });
    if (data.length === 0) {
      bot.sendMessage(msg.chat.id, "No issues created from Telegram yet.");
      return;
    }
    const list = data
      .map(
        (issue) =>
          `${issue.state === "open" ? "🟢" : "✅"} [#${issue.number}](${issue.html_url}) ${issue.title}`
      )
      .join("\n");
    bot.sendMessage(msg.chat.id, `📋 *Recent Issues*\n\n${list}`, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch (e) {
    bot.sendMessage(msg.chat.id, "❌ Couldn't fetch issues: " + e.message);
  }
});

// ═══════════════════════════════
//  Default: any text → Issue
// ═══════════════════════════════
bot.on("message", async (msg) => {
  // Skip commands
  if (!msg.text || msg.text.startsWith("/")) return;
  if (!isAllowed(msg.from.username)) {
    bot.sendMessage(msg.chat.id, "⛔ You're not authorized to use this bot.");
    return;
  }
  await createIssue(msg.chat.id, msg.text, []);
});

// ═══════════════════════════════
//  Photo support — screenshots
// ═══════════════════════════════
bot.on("photo", async (msg) => {
  if (!isAllowed(msg.from.username)) return;
  const caption = msg.caption || "Screenshot attached";
  const photo = msg.photo[msg.photo.length - 1]; // highest res
  const file = await bot.getFile(photo.file_id);
  const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

  const body = `${caption}\n\n![Screenshot](${url})\n\n---\n_Created via Telegram by @${msg.from.username || "unknown"}_`;
  await createIssue(msg.chat.id, caption, [], body);
});

// ═══════════════════════════════
//  Build structured issue body (issue #9)
//  — detailed info, no private data
// ═══════════════════════════════
function buildIssueBody(text, labels) {
  // Detect request type from labels
  const typeMap = {
    bug: "🐛 Bug Report",
    enhancement: "✨ Feature Request",
    ui: "🎨 UI/Design",
    content: "📝 Content / Guide",
    feeding: "🍼 Feeding",
    sleep: "😴 Sleep",
    health: "💜 Health",
    growth: "📊 Growth",
    "voice-input": "🎤 Voice Input",
    priority: "🔴 Priority",
  };
  const typeLabel = labels.map(l => typeMap[l]).filter(Boolean)[0] || "💬 Feedback";

  // Category tags (exclude meta-labels)
  const metaLabels = new Set(["telegram", "feedback", "priority"]);
  const categoryTags = labels.filter(l => !metaLabels.has(l)).map(l => `\`${l}\``).join(" ");

  return `## ${typeLabel}

${text}

---

**Category:** ${categoryTags || "`general`"}
**Source:** Telegram Bot
**Status:** Pending implementation

> _This issue was created automatically via the BabyBloom Telegram Bot. No private baby data is included._`;
}

// ═══════════════════════════════
//  Dedup: prevent double-tap duplicates
// ═══════════════════════════════
const _recentIssues = new Map(); // key → timestamp
const DEDUP_WINDOW_MS = 10_000;  // 10 second window

function isDuplicate(chatId, text) {
  const key = `${chatId}:${text.trim().toLowerCase()}`;
  const now = Date.now();
  const prev = _recentIssues.get(key);
  if (prev && now - prev < DEDUP_WINDOW_MS) return true;
  _recentIssues.set(key, now);
  // Cleanup old entries every 50 inserts
  if (_recentIssues.size > 50) {
    for (const [k, t] of _recentIssues) {
      if (now - t > DEDUP_WINDOW_MS) _recentIssues.delete(k);
    }
  }
  return false;
}

// ═══════════════════════════════
//  Core: Create GitHub Issue
// ═══════════════════════════════
async function createIssue(chatId, text, forceLabels, customBody) {
  if (isDuplicate(chatId, text)) {
    console.log(`⏭️ Skipping duplicate issue: "${text.slice(0, 40)}..."`);
    return;
  }
  try {
    const { labels: autoLabels, emojis } = detectLabels(text);
    const allLabels = [...new Set([...forceLabels, ...autoLabels, "telegram"])];

    await ensureLabels(allLabels);

    const title = generateTitle(text);
    const body = customBody || buildIssueBody(text, allLabels);

    const { data: issue } = await octokit.rest.issues.create({
      owner, repo,
      title,
      body,
      labels: allLabels,
    });

    // Write to local queue so Claude's scheduled task can pick it up
    addToQueue(issue, allLabels);

    const labelStr = allLabels
      .map((l) => `\`${l}\``)
      .join(" ");

    bot.sendMessage(
      chatId,
      `✅ *Issue #${issue.number} created!*\n\n📌 ${title}\n🏷️ ${labelStr}\n🔗 [View on GitHub](${issue.html_url})`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
  } catch (e) {
    console.error("Error creating issue:", e);
    bot.sendMessage(
      chatId,
      `❌ Failed to create issue: ${e.message}\n\nYour message has been saved. Try again or check the bot logs.`
    );
  }
}

// ─── Startup ───
console.log("🍼 BabyBloom Telegram Bot started!");
console.log(`📡 Repo: ${GITHUB_REPO}`);
console.log(
  `🔒 Allowed users: ${ALLOWED_USERS.length > 0 ? ALLOWED_USERS.join(", ") : "everyone (set ALLOWED_USERS to restrict)"}`
);
