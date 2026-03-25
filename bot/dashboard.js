#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  🍼 BabyBloom Internal Dashboard
//  Run: node dashboard.js
//  Open: http://localhost:4040
// ═══════════════════════════════════════════════════════════════

const http       = require('http');
const fs         = require('fs');
const path       = require('path');
const { spawn }  = require('child_process');

// ─── Pipeline runner state ───────────────────────────────────────
let pipelineRunning = false;
let pipelineStarted = null;  // ISO timestamp of last manual trigger
let pipelinePid     = null;

const PORT    = 4040;
const BOT_DIR = __dirname;                        // bot/
const REPO_DIR = path.join(__dirname, '..');      // babybloom/

// ─── Helpers ────────────────────────────────────────────────────
function readFile(p)  { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readJSON(p)  { try { return JSON.parse(readFile(p)); }    catch { return null; } }
function esc(s)       {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(d) {
  return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

// ─── Pipeline Log Parser ────────────────────────────────────────
function parsePipelineLog() {
  const log   = readFile(path.join(BOT_DIR, 'pipeline.log'));
  const lines = log.split('\n');
  const runs  = [];
  let cur     = null;

  function flush() { if (cur) { runs.push(cur); cur = null; } }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // ── New-format run header ──────────────────────────────────
    if (line.includes('BabyBloom Pipeline —')) {
      flush();
      const ts = line.replace(/.*Pipeline — /, '').trim();
      cur = { ts, format:'new', events:[], status:'idle', sha:null, files:[], closed:[], ciResult:null, sentry:'unknown', errors:[] };
      continue;
    }

    // ── Old-format run header ──────────────────────────────────
    if (line.includes('=== BabyBloom pipeline started ===')) {
      flush();
      const m = line.match(/\[(.+?)\]/);
      cur = { ts: m ? m[1] : 'unknown', format:'old', events:[], status:'idle', sha:null, files:[], closed:[], ciResult:null, sentry:'unknown', errors:[] };
      continue;
    }

    if (!cur) continue;
    cur.events.push(line);

    // ── Status signals ─────────────────────────────────────────
    if (line.includes('Nothing to push') || (line.includes('push.') && line.includes('ℹ️')))
      cur.status = 'idle';

    if (line.includes('Uncommitted changes') || line.includes('unpushed commits'))
      cur.status = 'deploying';

    if (line.includes('❌') || line.toLowerCase().includes('push failed') ||
        line.includes('error:') || line.includes('fatal:'))
      { cur.status = 'error'; cur.errors.push(line); }

    if (line.includes('GitHub Actions completed: success'))
      { cur.ciResult = 'success'; cur.status = 'success'; }
    if (line.includes('GitHub Actions completed: failure'))
      { cur.ciResult = 'failure'; cur.status = 'error'; }

    // ── Extract SHA ────────────────────────────────────────────
    let m;
    if ((m = line.match(/(?:Pushed|Push successful|sha=)[:= ]*([a-f0-9]{7,})/i)))
      cur.sha = m[1];
    if ((m = line.match(/^\s+([a-f0-9]{7,})\s+\w/)))  // git log line
      if (!cur.sha) cur.sha = m[1];
    // commit line like "[main abc1234]"
    if ((m = line.match(/\[main ([a-f0-9]{7,})\]/)))
      cur.sha = m[1];

    // ── Extract staged files ───────────────────────────────────
    if ((m = line.match(/Staged: (.+)/)))
      cur.files.push(...m[1].split(',').map(f => f.trim()));

    // ── Issues closed ─────────────────────────────────────────
    if ((m = line.match(/Closed #(\d+): (.+)/)))
      cur.closed.push({ num: m[1], title: m[2] });

    // ── Sentry ────────────────────────────────────────────────
    if (line.includes('No new Sentry errors')) cur.sentry = 'clean';
    if (line.includes('Sentry error') || line.includes('new Sentry')) cur.sentry = 'errors';
  }
  flush();

  return runs.reverse(); // most recent first
}

// ─── Bot Log Parser ─────────────────────────────────────────────
function parseBotLog() {
  const log   = readFile(path.join(BOT_DIR, 'bot.log'));
  const lines = log.split('\n').filter(Boolean);

  const conflicts  = lines.filter(l => l.includes('409 Conflict')).length;
  const starts     = lines.filter(l => l.includes('Bot started') || l.includes('Lock acquired'));
  const lastStart  = starts[starts.length - 1] || '';
  const lastError  = [...lines].reverse().find(l => l.includes('EFATAL') || l.includes('ECONNRESET')) || '';
  const recentLines = lines.slice(-10);
  const isHealthy  = recentLines.some(l => l.includes('Lock acquired') || l.includes('Bot started'));

  return { conflicts, lastStart, lastError, recentLines, isHealthy, totalLines: lines.length };
}

// ─── Issues Parser ──────────────────────────────────────────────
function parseIssues() {
  const all     = readJSON(path.join(BOT_DIR, 'pending-issues.json')) || [];
  const pending = all.filter(i => !['done','closed','skipped'].includes(i.status));
  const skipped = all.filter(i => i.status === 'skipped');
  const done    = all.filter(i => i.status === 'done' || i.status === 'closed');
  return { all, pending, skipped, done, total: all.length };
}

// ─── Sentry Parser ──────────────────────────────────────────────
function parseSentry() {
  const data   = readJSON(path.join(BOT_DIR, 'sentry-tracked.json')) || {};
  const keys   = Object.keys(data);
  const maxSeq = keys.length ? Math.max(...Object.values(data)) : 0;
  return { tracked: keys.length, maxSeq };
}

// ─── Git Stats ──────────────────────────────────────────────────
function getGitInfo() {
  try {
    const log = require('child_process').execSync(
      'git -C "' + REPO_DIR + '" log --oneline -5 2>/dev/null', {timeout:3000}
    ).toString().trim();
    const branch = require('child_process').execSync(
      'git -C "' + REPO_DIR + '" branch --show-current 2>/dev/null', {timeout:3000}
    ).toString().trim();
    return { log: log.split('\n'), branch };
  } catch { return { log: [], branch: 'main' }; }
}

// ─── UI Helpers ─────────────────────────────────────────────────
const COLORS = {
  bg:'#FFF8F0', card:'#FFFFFF', primary:'#FF6B8A', primaryLight:'#FFE0E8',
  secondary:'#6C63FF', secondaryLight:'#E8E6FF', accent:'#00C9A7',
  accentLight:'#E0FFF8', warning:'#FFB347', warningLight:'#FFF3E0',
  text:'#2D2D3A', textLight:'#8E8E9A', border:'#F0EBE3',
  success:'#4CAF50', blue:'#42A5F5', blueLight:'#E3F2FD',
  purple:'#AB47BC', purpleLight:'#F3E5F5',
};

const STATUS_MAP = {
  idle:      { bg:'#E8E6FF', color:'#6C63FF', icon:'⚡', label:'Idle' },
  deploying: { bg:'#FFF3E0', color:'#FFB347', icon:'📦', label:'Deploying' },
  success:   { bg:'#E0FFF8', color:'#00C9A7', icon:'✅', label:'Success' },
  error:     { bg:'#FFE8EC', color:'#FF6B8A', icon:'❌', label:'Error' },
};

function badge(status) {
  const s = STATUS_MAP[status] || { bg:'#F0EBE3', color:'#8E8E9A', icon:'·', label:status };
  return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px">${s.icon} ${s.label}</span>`;
}

const LABEL_COLORS = {
  bug:'#FF6B8A', enhancement:'#6C63FF', ui:'#AB47BC', content:'#42A5F5',
  health:'#00C9A7', feeding:'#FFB347', sleep:'#6C63FF', growth:'#4CAF50',
  telegram:'#229ED9', feedback:'#8E8E9A', priority:'#FF6B8A', default:'#8E8E9A',
};
function pill(label) {
  const c = LABEL_COLORS[label] || LABEL_COLORS.default;
  return `<span style="background:${c}22;color:${c};padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin:1px 2px;display:inline-block">${esc(label)}</span>`;
}

function dot(healthy, size=8) {
  const c = healthy ? COLORS.accent : COLORS.primary;
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${c};margin-right:6px;animation:pulse 2s infinite"></span>`;
}

// ─── Render ─────────────────────────────────────────────────────
function render() {
  const runs   = parsePipelineLog();
  const bot    = parseBotLog();
  const issues = parseIssues();
  const sentry = parseSentry();
  const git    = getGitInfo();
  const now    = new Date().toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

  const lastRun      = runs[0];
  const deploys      = runs.filter(r => r.sha);
  const errors       = runs.filter(r => r.status === 'error');
  const pStatus      = lastRun?.status || 'idle';
  const pSt          = STATUS_MAP[pStatus] || STATUS_MAP.idle;

  // ── Pipeline runs HTML ────────────────────────────────────────
  const runsHtml = runs.slice(0, 25).map((run, i) => {
    const st = STATUS_MAP[run.status] || STATUS_MAP.idle;
    const isFirst = i === 0;
    return `
      <div style="background:${isFirst ? '#FFFDF8' : '#fff'};border:1.5px solid ${isFirst ? COLORS.border : '#F5F0EB'};border-radius:12px;padding:13px 15px;margin-bottom:7px;transition:box-shadow .2s" onmouseenter="this.style.boxShadow='0 2px 12px rgba(255,107,138,.08)'" onmouseleave="this.style.boxShadow=''">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:11px;color:${COLORS.textLight};font-family:monospace">${esc(run.ts)}</span>
              ${badge(run.status)}
              ${run.sentry === 'clean' ? `<span style="font-size:10px;color:${COLORS.accent}">🛡️ Sentry OK</span>` : ''}
              ${run.ciResult ? `<span style="font-size:10px;color:${run.ciResult==='success'?COLORS.accent:COLORS.primary}">CI ${run.ciResult}</span>` : ''}
            </div>
            ${run.sha ? `<div style="font-size:11px;margin-bottom:3px">SHA <code style="background:#F0EBE3;padding:1px 6px;border-radius:4px;font-size:11px">${run.sha}</code>${run.ciResult ? ` · CI ${run.ciResult==='success'?'✅':'❌'}` : ''}</div>` : ''}
            ${run.files.length ? `<div style="font-size:11px;color:${COLORS.secondary};margin-bottom:3px">📦 ${run.files.map(esc).join(' · ')}</div>` : ''}
            ${run.closed.length ? `<div style="font-size:11px;color:${COLORS.accent}">${run.closed.map(c=>`✅ Closed #${c.num}: ${esc(c.title.slice(0,50))}`).join(' · ')}</div>` : ''}
            ${run.errors.length && run.status==='error' ? `<div style="font-size:10px;color:${COLORS.primary};margin-top:3px;font-family:monospace">${esc(run.errors[0].slice(0,90))}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('') || `<div style="color:${COLORS.textLight};font-size:13px;text-align:center;padding:24px">No runs yet</div>`;

  // ── Issues HTML ───────────────────────────────────────────────
  const issueStatusIcon = s => s==='done'?'✅':s==='skipped'?'⏭️':s==='closed'?'🔒':'⏳';
  const issuesHtml = issues.all.slice(0, 20).map(issue => `
    <div style="border:1px solid ${COLORS.border};border-radius:11px;padding:11px 14px;margin-bottom:7px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
            <span style="font-size:10px;color:${COLORS.textLight};font-weight:700">#${issue.number}</span>
            <span style="font-size:12px;font-weight:600;color:${COLORS.text}">${esc(issue.title)}</span>
          </div>
          <div>${(issue.labels||[]).map(pill).join('')}</div>
          ${issue.skip_reason ? `<div style="font-size:10px;color:${COLORS.textLight};margin-top:5px;line-height:1.4">↪ ${esc(issue.skip_reason.slice(0,110))}${issue.skip_reason.length>110?'…':''}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;margin-top:2px">
          <span style="font-size:14px">${issueStatusIcon(issue.status)}</span>
          <a href="${esc(issue.url||'#')}" target="_blank" style="font-size:10px;color:${COLORS.secondary};text-decoration:none;font-weight:600">↗</a>
        </div>
      </div>
    </div>`).join('') || `<div style="color:${COLORS.textLight};font-size:13px;text-align:center;padding:20px">No issues</div>`;

  // ── Bot Log HTML ──────────────────────────────────────────────
  const botLogHtml = bot.recentLines.slice(-10).map(l => {
    const c = l.includes('error')||l.includes('❌') ? '#FF6B8A'
            : l.includes('✅')||l.includes('started')||l.includes('Lock acquired') ? '#00C9A7'
            : '#9090A0';
    return `<div style="font-size:10.5px;color:${c};padding:1.5px 0;font-family:'SF Mono',Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.slice(0,130))}</div>`;
  }).join('');

  // ── Git log HTML ──────────────────────────────────────────────
  const gitHtml = git.log.map(l => {
    const m = l.match(/^([a-f0-9]{7,})\s+(.+)/);
    if (!m) return '';
    return `<div style="font-size:11px;padding:3px 0;border-bottom:1px solid #F0EBE3;display:flex;gap:8px;align-items:center">
      <code style="background:#F0EBE3;padding:1px 5px;border-radius:4px;font-size:10px;flex-shrink:0">${m[1]}</code>
      <span style="color:${COLORS.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m[2])}</span>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🍼 BabyBloom · Internal Dashboard</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#FFF8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2D2D3A;min-height:100vh}

  /* Header */
  .hdr{background:linear-gradient(135deg,#FF6B8A 0%,#6C63FF 100%);padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 2px 16px rgba(255,107,138,.25)}
  .hdr-title h1{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.3px}
  .hdr-title p{color:rgba(255,255,255,.8);font-size:12px;margin-top:3px}
  .hdr-right{display:flex;align-items:center;gap:10px}
  .rbtn{background:rgba(255,255,255,.2);color:#fff;border:none;padding:7px 16px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:700;transition:background .2s}
  .rbtn:hover{background:rgba(255,255,255,.32)}
  .countdown{color:rgba(255,255,255,.7);font-size:11px}

  /* Layout */
  .wrap{max-width:1080px;margin:0 auto;padding:22px 16px}

  /* Stat cards */
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:20px}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
  .sc{background:#fff;border:1.5px solid #F0EBE3;border-radius:16px;padding:16px 18px;transition:box-shadow .2s}
  .sc:hover{box-shadow:0 4px 20px rgba(255,107,138,.1)}
  .sc .ico{font-size:22px;margin-bottom:8px}
  .sc .val{font-size:30px;font-weight:800;line-height:1}
  .sc .lbl{font-size:11px;color:#8E8E9A;margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}

  /* Status strip */
  .strip{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
  @media(max-width:600px){.strip{grid-template-columns:1fr}}
  .scard{background:#fff;border:1.5px solid #F0EBE3;border-radius:16px;padding:18px}

  /* Sections */
  .section{background:#fff;border:1.5px solid #F0EBE3;border-radius:16px;padding:20px;margin-bottom:16px}
  .sec-title{font-size:14px;font-weight:800;color:#2D2D3A;margin-bottom:14px;display:flex;align-items:center;gap:8px;letter-spacing:-.1px}
  .cnt{background:#FFE0E8;color:#FF6B8A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}
  .cnt2{background:#E8E6FF;color:#6C63FF;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}
  .cnt3{background:#E0FFF8;color:#00C9A7;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}

  /* Two col layout */
  .two{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
  @media(max-width:720px){.two{grid-template-columns:1fr}}

  /* Bot log box */
  .logbox{background:#1E1E2E;border-radius:10px;padding:12px 14px;margin-top:8px;overflow:hidden}

  /* Animations */
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}

  /* Divider */
  .div{height:1px;background:#F0EBE3;margin:14px 0}

  /* Meta pill */
  .meta{display:inline-flex;align-items:center;gap:5px;background:#F0EBE3;border-radius:10px;padding:3px 9px;font-size:11px;color:#8E8E9A;font-weight:600}
</style>
</head>
<body>

<!-- Header -->
<div class="hdr">
  <div class="hdr-title">
    <h1>🍼 BabyBloom Dashboard</h1>
    <p>Pipeline · Bot · Issues · Sentry &nbsp;·&nbsp; ${now}</p>
  </div>
  <div class="hdr-right">
    <span class="countdown" id="cd"></span>
    <button class="rbtn" onclick="location.reload()">↻ Refresh</button>
    <button class="rbtn run-btn" id="runBtn" onclick="runPipeline()" style="background:rgba(255,255,255,0.92);color:#FF6B8A;font-weight:800">▶ Run Pipeline</button>
  </div>
</div>

<!-- Live console drawer (hidden by default) -->
<div id="consoleDrawer" style="display:none;background:#1A1A2E;border-bottom:2px solid #6C63FF;padding:0">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid #2A2A3E">
    <div style="display:flex;align-items:center;gap:10px">
      <span id="consoleStatus" style="font-size:13px;color:#00C9A7;font-weight:700">● Pipeline running…</span>
      <span id="consolePid" style="font-size:11px;color:#666;font-family:monospace"></span>
    </div>
    <button onclick="toggleConsole()" style="background:none;border:none;color:#666;cursor:pointer;font-size:18px;padding:0 4px">✕</button>
  </div>
  <div id="consoleLog" style="height:220px;overflow-y:auto;padding:12px 20px;font-family:'SF Mono',Menlo,monospace;font-size:11.5px;line-height:1.6"></div>
</div>

<div class="wrap">

  <!-- ── Stats ─────────────────────────────────────────────── -->
  <div class="stats">
    <div class="sc">
      <div class="ico">🔄</div>
      <div class="val" style="color:#6C63FF">${runs.length}</div>
      <div class="lbl">Pipeline Runs</div>
    </div>
    <div class="sc">
      <div class="ico">🚀</div>
      <div class="val" style="color:#00C9A7">${deploys.length}</div>
      <div class="lbl">Deploys</div>
    </div>
    <div class="sc">
      <div class="ico">📋</div>
      <div class="val" style="color:#FFB347">${issues.total}</div>
      <div class="lbl">Issues</div>
    </div>
    <div class="sc">
      <div class="ico">❌</div>
      <div class="val" style="color:#FF6B8A">${errors.length}</div>
      <div class="lbl">Run Errors</div>
    </div>
  </div>

  <!-- ── Status Strip ──────────────────────────────────────── -->
  <div class="strip">
    <!-- Pipeline status -->
    <div class="scard">
      <div class="sec-title">⚡ Pipeline</div>
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pSt.color};margin-right:8px;animation:pulse 2s infinite"></span>
        <span style="font-size:13px;font-weight:700;color:#2D2D3A">${pStatus==='success'?'Last deploy succeeded':pStatus==='error'?'Last run had errors':pStatus==='deploying'?'Deploying…':'Watching for changes'}</span>
      </div>
      ${lastRun ? `<div style="font-size:11px;color:#8E8E9A;margin-bottom:4px">Last run: ${esc(lastRun.ts)}</div>` : ''}
      ${lastRun?.sha ? `<div style="font-size:11px;margin-bottom:4px">Latest SHA: <code style="background:#F0EBE3;padding:1px 6px;border-radius:4px">${lastRun.sha}</code></div>` : ''}
      ${lastRun?.files.length ? `<div style="font-size:11px;color:#6C63FF">📦 ${lastRun.files.map(esc).join(', ')}</div>` : ''}
      <div class="div"></div>
      <div class="meta">⏱ Every 30 min · LaunchAgent</div>
    </div>

    <!-- Bot status -->
    <div class="scard">
      <div class="sec-title">🤖 Telegram Bot</div>
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${bot.isHealthy?'#00C9A7':'#FF6B8A'};margin-right:8px;animation:pulse 2s infinite"></span>
        <span style="font-size:13px;font-weight:700">${bot.isHealthy ? '🟢 Bot is running' : '🔴 May be offline'}</span>
      </div>
      <div style="font-size:11px;color:#8E8E9A;margin-bottom:3px">409 conflicts: <strong style="color:#2D2D3A">${bot.conflicts}</strong></div>
      ${bot.lastError ? `<div style="font-size:10px;color:#FF6B8A;margin-top:5px;font-family:monospace">${esc(bot.lastError.slice(0,80))}</div>` : ''}
      <div class="div"></div>
      <div class="meta">🛡️ Sentry tracked: ${sentry.tracked} · Seq ${sentry.maxSeq}</div>
    </div>
  </div>

  <!-- ── Main Two-Col ───────────────────────────────────────── -->
  <div class="two">

    <!-- LEFT: Pipeline Runs -->
    <div class="section">
      <div class="sec-title">🔄 Pipeline Runs <span class="cnt">${runs.length}</span> <span class="cnt2">${deploys.length} deploys</span> <span style="background:#FFE8EC;color:#FF6B8A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800">${errors.length} errors</span></div>
      ${runsHtml}
    </div>

    <!-- RIGHT: Issues + Bot + Git -->
    <div>
      <!-- Issues -->
      <div class="section" style="margin-bottom:16px">
        <div class="sec-title">📋 Issue Queue
          <span class="cnt">${issues.pending.length} pending</span>
          <span style="background:#F0EBE3;color:#8E8E9A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800">${issues.skipped.length} skipped</span>
          <span class="cnt3">${issues.done.length} done</span>
        </div>
        ${issuesHtml}
      </div>

      <!-- Bot Log -->
      <div class="section" style="margin-bottom:16px">
        <div class="sec-title">🤖 Bot Log Tail</div>
        <div class="logbox">${botLogHtml || '<span style="color:#555;font-size:11px">No log data</span>'}</div>
        <div style="font-size:10px;color:#8E8E9A;margin-top:6px">${bot.totalLines} total lines</div>
      </div>

      <!-- Recent Commits -->
      ${git.log.length ? `
      <div class="section">
        <div class="sec-title">🗂 Recent Commits <span class="meta">${esc(git.branch)}</span></div>
        ${gitHtml}
      </div>` : ''}
    </div>

  </div>
</div><!-- /wrap -->

<script>
  // ── Auto-refresh countdown ──────────────────────────────────
  let t = 60;
  const cdEl = document.getElementById('cd');
  setInterval(() => {
    t--;
    if (t <= 15) cdEl.textContent = 'Auto-refresh in ' + t + 's';
    if (t <= 0) location.reload();
  }, 1000);

  // ── Console state ───────────────────────────────────────────
  let consoleOpen   = false;
  let sseSource     = null;
  let pipelineActive = ${pipelineRunning};

  function toggleConsole() {
    const drawer = document.getElementById('consoleDrawer');
    consoleOpen = !consoleOpen;
    drawer.style.display = consoleOpen ? 'block' : 'none';
  }

  function colorLine(line) {
    if (line.includes('❌') || line.includes('error') || line.includes('failed') || line.includes('fatal'))
      return '#FF6B8A';
    if (line.includes('✅') || line.includes('success') || line.includes('complete') || line.includes('🎉'))
      return '#00C9A7';
    if (line.includes('⏳') || line.includes('Waiting') || line.includes('🔄') || line.includes('📦'))
      return '#FFB347';
    if (line.includes('🔍') || line.includes('🧪') || line.includes('Sentry'))
      return '#6C63FF';
    return '#C0C0D0';
  }

  function appendLog(text) {
    const box = document.getElementById('consoleLog');
    const div = document.createElement('div');
    div.style.color = colorLine(text);
    div.style.padding = '1px 0';
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function startSSE() {
    if (sseSource) sseSource.close();
    sseSource = new EventSource('/api/log-stream');
    sseSource.onmessage = (e) => {
      const raw = JSON.parse(e.data);
      // Status heartbeat
      if (typeof raw === 'string' && raw.startsWith('__status:')) {
        const st = JSON.parse(raw.slice(9));
        updateRunBtn(st.running, st.pid);
        return;
      }
      appendLog(raw);
    };
    sseSource.onerror = () => {
      appendLog('⚠️  Connection to log stream lost — retrying…');
    };
  }

  function updateRunBtn(running, pid) {
    const btn = document.getElementById('runBtn');
    const status = document.getElementById('consoleStatus');
    const pidEl  = document.getElementById('consolePid');
    pipelineActive = running;
    if (running) {
      btn.textContent   = '⏳ Running…';
      btn.style.color   = '#FFB347';
      btn.disabled      = true;
      status.textContent = '● Pipeline running…';
      status.style.color = '#FFB347';
      pidEl.textContent  = pid ? 'PID ' + pid : '';
    } else {
      btn.textContent   = '▶ Run Pipeline';
      btn.style.color   = '#FF6B8A';
      btn.disabled      = false;
      status.textContent = '✅ Pipeline finished';
      status.style.color = '#00C9A7';
      pidEl.textContent  = '';
      // Reload page data after a short delay
      setTimeout(() => location.reload(), 3000);
    }
  }

  async function runPipeline() {
    if (pipelineActive) return;

    // Open console first
    const drawer = document.getElementById('consoleDrawer');
    consoleOpen = true;
    drawer.style.display = 'block';
    document.getElementById('consoleLog').innerHTML = '';
    appendLog('🍼 Triggering BabyBloom pipeline…');

    // Start SSE stream
    startSSE();

    // POST to trigger
    try {
      const r = await fetch('/api/run-pipeline', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        appendLog('❌ ' + (data.error || 'Failed to start pipeline'));
        return;
      }
      updateRunBtn(true, data.pid);
      appendLog('✅ Pipeline started (PID ' + data.pid + ')');
    } catch(e) {
      appendLog('❌ Fetch error: ' + e.message);
    }
  }

  // On load: if pipeline was already running, show console + stream
  if (pipelineActive) {
    document.getElementById('consoleDrawer').style.display = 'block';
    consoleOpen = true;
    updateRunBtn(true, ${pipelinePid || 'null'});
    startSSE();
  }
</script>
</body>
</html>`;
}

// ─── HTTP Server ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {

  // ── Health ────────────────────────────────────────────────────
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true, ts:new Date().toISOString()}));
    return;
  }

  // ── JSON data API ─────────────────────────────────────────────
  if (req.url === '/api') {
    res.writeHead(200, {'Content-Type':'application/json'});
    try {
      res.end(JSON.stringify({
        runs: parsePipelineLog().slice(0,30),
        bot: parseBotLog(),
        issues: parseIssues(),
        sentry: parseSentry(),
        pipelineRunning,
        pipelineStarted,
        pipelinePid,
      }, null, 2));
    } catch(e) { res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Pipeline status ───────────────────────────────────────────
  if (req.url === '/api/pipeline-status') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ running: pipelineRunning, started: pipelineStarted, pid: pipelinePid }));
    return;
  }

  // ── Trigger pipeline (POST /api/run-pipeline) ─────────────────
  if (req.method === 'POST' && req.url === '/api/run-pipeline') {
    if (pipelineRunning) {
      res.writeHead(409, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Pipeline already running', pid: pipelinePid }));
      return;
    }

    const PIPELINE_SH = path.join(BOT_DIR, 'pipeline.sh');
    if (!fs.existsSync(PIPELINE_SH)) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'pipeline.sh not found at ' + PIPELINE_SH }));
      return;
    }

    const env = Object.assign({}, process.env, {
      PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + process.env.PATH,
    });

    const child = spawn('/bin/bash', [PIPELINE_SH], {
      cwd: REPO_DIR,
      env,
      detached: false,
    });

    pipelineRunning = true;
    pipelineStarted = new Date().toISOString();
    pipelinePid     = child.pid;

    child.on('close', () => {
      pipelineRunning = false;
      pipelinePid     = null;
    });

    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true, pid: child.pid, started: pipelineStarted }));
    return;
  }

  // ── Live log tail via SSE (/api/log-stream) ───────────────────
  if (req.url === '/api/log-stream') {
    const LOG_FILE = path.join(BOT_DIR, 'pipeline.log');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send last 30 lines immediately
    const existing = readFile(LOG_FILE).split('\n').filter(Boolean).slice(-30);
    existing.forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));

    // Watch for new lines
    let lastSize = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
    const watcher = setInterval(() => {
      try {
        const stat = fs.statSync(LOG_FILE);
        if (stat.size > lastSize) {
          const buf = Buffer.alloc(stat.size - lastSize);
          const fd  = fs.openSync(LOG_FILE, 'r');
          fs.readSync(fd, buf, 0, buf.length, lastSize);
          fs.closeSync(fd);
          lastSize = stat.size;
          const newLines = buf.toString('utf8').split('\n').filter(Boolean);
          newLines.forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));
        }
        // Also send pipeline status as a heartbeat
        res.write(`data: ${JSON.stringify('__status:' + JSON.stringify({running:pipelineRunning,pid:pipelinePid}))}\n\n`);
      } catch {}
    }, 800);

    req.on('close', () => clearInterval(watcher));
    return;
  }

  // ── Main dashboard HTML ───────────────────────────────────────
  try {
    const html = render();
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(html);
  } catch(e) {
    res.writeHead(500, {'Content-Type':'text/plain'});
    res.end('Dashboard error: ' + e.message + '\n' + e.stack);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('🍼  BabyBloom Internal Dashboard');
  console.log('──────────────────────────────────');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log('  Auto-refreshes every 60s in browser');
  console.log('');
});
