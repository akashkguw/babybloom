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
let pipelineRunning   = false;
let pipelineStarted   = null;   // ISO timestamp of last manual trigger
let pipelinePid       = null;
let pipelineLogOffset = 0;      // byte offset in pipeline.log when run was triggered

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

// ─── Live Run Parser (manual trigger in progress) ──────────────
function parseLiveRun() {
  const LOG_FILE = path.join(BOT_DIR, 'pipeline.log');
  const events   = [];
  try {
    const stat = fs.statSync(LOG_FILE);
    const from = Math.min(pipelineLogOffset, stat.size);
    if (stat.size > from) {
      const len = stat.size - from;
      const buf = Buffer.alloc(len);
      const fd  = fs.openSync(LOG_FILE, 'r');
      fs.readSync(fd, buf, 0, len, from);
      fs.closeSync(fd);
      events.push(...buf.toString('utf8').split('\n').filter(Boolean));
    }
  } catch {}

  const e    = events.join('\n');
  const run  = { events, sha: null, files: [], closed: [], ciResult: null, sentry: 'unknown', errors: [], status: 'deploying' };
  let m;
  if ((m = e.match(/(?:Pushed|Push successful)[:= ]*([a-f0-9]{7,})/i))) run.sha = m[1];
  if ((m = e.match(/\[main ([a-f0-9]{7,})\]/)))                         run.sha = m[1];
  if ((m = e.match(/Staged: (.+)/)))      run.files.push(...m[1].split(',').map(f => f.trim()));
  if (e.includes('GitHub Actions completed: success')) { run.ciResult = 'success'; run.status = 'success'; }
  if (e.includes('GitHub Actions completed: failure')) { run.ciResult = 'failure'; run.status = 'error';   }
  const errLine = events.find(l => l.includes('❌') || l.toLowerCase().includes('fatal:'));
  if (errLine) run.errors.push(errLine);

  const stages = parseStages(run);

  // If still running: mark the first not-yet-resolved stage as 'running'
  if (pipelineRunning) {
    let lastDone = -1;
    for (let i = 0; i < stages.length; i++) {
      if (['pass','fail','warn'].includes(stages[i].status)) lastDone = i;
    }
    for (let i = lastDone + 1; i < stages.length; i++) {
      if (stages[i].status !== 'skip') { stages[i].status = 'running'; break; }
    }
  }

  return {
    stages,
    recentLines: events.slice(-6),
    running: pipelineRunning,
    pid:     pipelinePid,
  };
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

// ─── Stage Parser ────────────────────────────────────────────────
// Returns ordered stages with status for a single pipeline run
const STAGE_DEFS = [
  { id:'queue',   label:'Queue Sync',    icon:'📋', desc:'' },
  { id:'sentry',  label:'Sentry',        icon:'🛡️', desc:'' },
  { id:'changes', label:'Changes',       icon:'🔍', desc:'' },
  { id:'scan',    label:'Secret Scan',   icon:'🔒', desc:'' },
  { id:'ci',      label:'Local CI',      icon:'🧪', desc:'' },
  { id:'push',    label:'Git Push',      icon:'🚀', desc:'' },
  { id:'actions', label:'GH Actions',    icon:'⚙️', desc:'' },
  { id:'notify',  label:'Telegram',      icon:'📱', desc:'' },
];

// pass | fail | skip | warn | running
function parseStages(run) {
  const e = run.events.join('\n');
  const hasChanges   = e.includes('Uncommitted changes') || e.includes('unpushed commits') || e.includes('Found unpushed');
  const nothingToPush = e.includes('Nothing to push') && !hasChanges;
  const pushed       = !!run.sha || e.includes('Push successful');

  return STAGE_DEFS.map(s => {
    const st = Object.assign({}, s);
    switch (s.id) {
      case 'queue':
        st.status = e.includes('Queue already up to date') ? 'pass'
                  : e.includes('Synced') ? 'pass' : 'skip';
        st.desc = e.match(/Synced (\d+ issues?)/)?.[1] || (st.status === 'pass' ? 'Up to date' : '');
        break;
      case 'sentry':
        st.status = e.includes('No new Sentry') ? 'pass'
                  : e.includes('Sentry error') ? 'fail' : 'skip';
        st.desc = st.status === 'pass' ? 'No new errors' : st.status === 'fail' ? 'Errors found' : '';
        break;
      case 'changes':
        st.status = nothingToPush ? 'skip' : hasChanges ? 'pass' : 'skip';
        st.label  = nothingToPush ? 'No Changes' : hasChanges ? 'Changes' : 'Changes';
        st.desc   = nothingToPush ? 'Nothing to push' : run.files.length ? run.files.slice(0,2).join(', ') : '';
        break;
      case 'scan':
        st.status = !hasChanges ? 'skip'
                  : e.includes('Secret scan passed') ? 'pass'
                  : e.includes('Secret') ? 'fail' : 'skip';
        st.desc = st.status === 'pass' ? 'No secrets' : st.status === 'fail' ? 'BLOCKED' : '';
        break;
      case 'ci':
        st.status = !hasChanges ? 'skip'
                  : e.includes('All CI stages passed') ? 'pass'
                  : e.includes('CI failed') || e.includes('CI checks failed') ? 'fail'
                  : e.includes('node: command not found') ? 'warn'
                  : e.includes('feature checks passed') ? 'pass'
                  : e.includes('CI checks') ? 'pass' : 'skip';
        { const stagesPass = (e.match(/✅.*passed/g)||[]).length;
          const stagesFail = (e.match(/❌.*FAILED/g)||[]).length;
          st.desc = e.includes('All CI stages passed') ? '3/3 stages'
                  : stagesPass||stagesFail ? `${stagesPass} ok${stagesFail?' · '+stagesFail+' fail':''}`
                  : e.match(/All (\d+) feature checks passed/)?.[0]?.replace('All ','') || ''; }
        break;
      case 'push':
        st.status = !hasChanges ? 'skip'
                  : pushed ? 'pass'
                  : e.includes('Push failed') || e.includes('rejected') ? 'fail' : 'skip';
        st.desc = run.sha || '';
        break;
      case 'actions':
        st.status = run.ciResult === 'success' ? 'pass'
                  : run.ciResult === 'failure' ? 'fail'
                  : e.includes('Waiting for GitHub Actions') ? 'running' : 'skip';
        st.desc = run.ciResult ? 'CI ' + run.ciResult : e.includes('Waiting') ? 'Waiting…' : '';
        break;
      case 'notify':
        st.status = e.includes('Telegram notified') || e.includes('Pipeline complete') ? 'pass'
                  : 'skip';
        st.desc = st.status === 'pass' ? 'Notified' : '';
        break;
    }
    return st;
  });
}

// Visual stage card for one stage
const STAGE_STYLE = {
  pass:    { border:'#00C9A7', bg:'#E0FFF8', iconBg:'#00C9A720', badge:'✅', badgeColor:'#00C9A7' },
  fail:    { border:'#FF6B8A', bg:'#FFE8EC', iconBg:'#FF6B8A20', badge:'❌', badgeColor:'#FF6B8A' },
  skip:    { border:'#E8E4DE', bg:'#FAFAF8', iconBg:'#F0EBE3',   badge:'·',  badgeColor:'#C8C0B8' },
  warn:    { border:'#FFB347', bg:'#FFF3E0', iconBg:'#FFB34720', badge:'⚠️', badgeColor:'#FFB347' },
  running: { border:'#6C63FF', bg:'#E8E6FF', iconBg:'#6C63FF20', badge:'⏳', badgeColor:'#6C63FF' },
};

function stageCard(st, size='full') {
  const style = STAGE_STYLE[st.status] || STAGE_STYLE.skip;
  const muted  = st.status === 'skip';
  const isRunning = st.status === 'running';

  if (size === 'mini') {
    const c = st.status==='pass'?'#00C9A7':st.status==='fail'?'#FF6B8A':
              st.status==='warn'?'#FFB347':st.status==='running'?'#6C63FF':'#D8D0C8';
    return `<span title="${esc(st.label)}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>`;
  }

  return `<div class="stage-card" style="border:2px solid ${style.border};background:${style.bg};opacity:${muted?.5:1};${isRunning?'animation:runpulse 1.5s infinite':''}">
    <div style="width:30px;height:30px;border-radius:9px;background:${style.iconBg};display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:6px;flex-shrink:0">${st.icon}</div>
    <div style="font-size:9.5px;font-weight:800;color:${muted?'#B0A898':'#2D2D3A'};letter-spacing:.1px;text-align:center;line-height:1.3;margin-bottom:3px">${st.label}</div>
    ${st.desc ? `<div style="font-size:8.5px;color:${muted?'#C8C0B8':'#8E8E9A'};text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${esc(st.desc)}</div>` : '<div style="height:11px"></div>'}
    <div style="margin-top:6px;font-size:13px;line-height:1">${style.badge}</div>
  </div>`;
}

const STAGE_CONNECTOR = `<div class="stage-connector"><div class="stage-connector-line"></div></div>`;

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

  // ── Latest run: full visual pipeline ─────────────────────────
  let latestPipelineHtml = `<div style="color:${COLORS.textLight};font-size:13px;text-align:center;padding:24px">No runs yet</div>`;
  if (lastRun) {
    const stages = parseStages(lastRun);
    latestPipelineHtml = `
      <div class="pipeline-flow">
        ${stages.map((s,i) => stageCard(s,'full') + (i < stages.length-1 ? STAGE_CONNECTOR : '')).join('')}
      </div>
      ${lastRun.closed.length ? `<div style="margin-top:10px;padding:9px 12px;background:#E0FFF8;border-radius:10px;font-size:11px;color:#00A882">✅ Closed in this run: ${lastRun.closed.map(c=>`<a href="#" style="color:#007A60;font-weight:700">#${c.num}</a> ${esc(c.title.slice(0,45))}`).join(' · ')}</div>` : ''}
      ${lastRun.errors.length ? `<div style="margin-top:10px;padding:9px 12px;background:#FFE8EC;border-radius:10px;font-size:11px;color:#CC3355;font-family:monospace">${esc(lastRun.errors[0].slice(0,140))}</div>` : ''}
    `;
  }

  // ── Run history: compact rows with mini stage dots ────────────
  const historyHtml = runs.slice(1, 35).map(run => {
    const stages   = parseStages(run);
    const dots     = stages.map(s => stageCard(s,'mini')).join('<span style="width:6px;height:1.5px;background:#E0D8D0;display:inline-block;vertical-align:middle;flex-shrink:0"></span>');
    const isError  = run.status === 'error';
    const isDeploy = !!run.sha;
    const tsShort  = run.ts.replace(/ PDT.*$/,'').replace(/^\w+ /,''); // "Mar 24 20:44:06"
    return `
      <div class="hist-row ${isDeploy?'is-deploy':''} ${isError?'is-error':''}">
        <span style="font-size:10px;color:#A8A098;font-family:monospace;white-space:nowrap">${esc(tsShort)}</span>
        <div class="stage-dots">${dots}</div>
        <div style="display:flex;align-items:center;gap:6px;overflow:hidden;min-width:0">
          ${isDeploy ? `<code style="background:#E8E6FF;color:#6C63FF;padding:1px 6px;border-radius:5px;font-size:10px;flex-shrink:0">${run.sha}</code>` : ''}
          <span style="font-size:10px;color:${isDeploy?'#6C63FF':isError?'#FF6B8A':'#C0B8B0'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${run.files.length ? '📦 '+run.files.map(esc).join(', ') : isError ? (run.errors[0]||'error').slice(0,60) : 'nothing to push'}
          </span>
        </div>
      </div>`;
  }).join('') || '';

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
  .strip{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  @media(max-width:600px){.strip{grid-template-columns:1fr}}

  /* Sections */
  .section{background:#fff;border:1.5px solid #F0EBE3;border-radius:16px;padding:20px;margin-bottom:16px}
  .sec-title{font-size:14px;font-weight:800;color:#2D2D3A;margin-bottom:14px;display:flex;align-items:center;gap:8px;letter-spacing:-.1px}
  .cnt{background:#FFE0E8;color:#FF6B8A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}
  .cnt2{background:#E8E6FF;color:#6C63FF;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}
  .cnt3{background:#E0FFF8;color:#00C9A7;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800}

  /* Bot log box */
  .logbox{background:#1E1E2E;border-radius:10px;padding:12px 14px;margin-top:8px;overflow:hidden}

  /* Pipeline stage cards — full-width flow */
  .pipeline-flow{display:flex;align-items:center;gap:0;width:100%}
  .stage-card{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:14px 6px 12px;border-radius:14px;flex:1;min-width:0;transition:transform .15s,box-shadow .15s;cursor:default;position:relative}
  .stage-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.09)}
  .stage-connector{flex-shrink:0;width:28px;display:flex;align-items:center;justify-content:center;padding-bottom:14px}
  .stage-connector-line{width:100%;height:2px;background:linear-gradient(90deg,#E0D8D0 0%,#C8C0B8 100%)}

  /* Run history rows */
  .hist-row{display:grid;grid-template-columns:148px auto 1fr;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;transition:background .12s}
  .hist-row:hover{background:#F8F5F0}
  .hist-row.is-deploy:hover{background:#F0FFF8}
  .hist-row.is-error:hover{background:#FFF0F3}
  .stage-dots{display:flex;align-items:center;gap:3px}

  /* Info / status strip */
  .scard{background:#fff;border:1.5px solid #F0EBE3;border-radius:16px;padding:16px 18px}

  /* Animations */
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  @keyframes runpulse{0%,100%{box-shadow:0 0 0 0 rgba(108,99,255,.35)}70%{box-shadow:0 0 0 6px rgba(108,99,255,0)}}

  /* Divider */
  .div{height:1px;background:#F0EBE3;margin:12px 0}

  /* Meta pill */
  .meta{display:inline-flex;align-items:center;gap:5px;background:#F0EBE3;border-radius:10px;padding:3px 9px;font-size:11px;color:#8E8E9A;font-weight:600}

  /* Bottom two col */
  .bottom-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:760px){.bottom-two{grid-template-columns:1fr}}
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
    <button class="rbtn" id="runBtn" onclick="runPipeline()" style="background:rgba(255,255,255,0.92);color:#FF6B8A;font-weight:800;border:none;min-width:120px">▶ Run Pipeline</button>
  </div>
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

  <!-- ── Latest Run: full-width visual pipeline ────────────── -->
  <div class="section" id="latest-run-wrap" style="margin-bottom:16px">
    <div class="sec-title" id="latest-run-title" style="justify-content:space-between;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span id="latest-run-label">🔄 Latest Run</span>
        <span id="latest-run-badge">${lastRun ? badge(lastRun.status) : ''}</span>
        ${lastRun ? `<span style="font-size:11px;color:#A8A098;font-family:monospace;font-weight:400">${esc(lastRun.ts)}</span>` : ''}
      </div>
    </div>
    <div id="live-pipeline-flow">${latestPipelineHtml}</div>
    <div id="live-log-strip" style="display:none;margin-top:14px;background:#F4F0FF;border:1px solid #D8D4FF;border-radius:10px;padding:10px 14px;font-family:'SF Mono',Menlo,monospace;font-size:10.5px;line-height:1.7;color:#4A4470"></div>
  </div>

  <!-- ── Run History: full-width compact list ───────────────── -->
  <div class="section" style="margin-bottom:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="sec-title" style="margin-bottom:0">📜 Run History <span class="cnt">${runs.length}</span> <span class="cnt2">${deploys.length} deploys</span> <span style="background:#FFE8EC;color:#FF6B8A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800">${errors.length} errors</span></div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${[['#00C9A7','Deploy'],['#FF6B8A','Error'],['#FFB347','Warn'],['#D8D0C8','Idle']].map(([c,l])=>
          `<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#8E8E9A"><span style="width:7px;height:7px;border-radius:50%;background:${c};display:inline-block"></span>${l}</span>`
        ).join('')}
        <span style="font-size:10px;color:#C0B8B0;font-family:monospace">Q Se Ch Sc CI Push GHA TG</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px">
      ${historyHtml || `<div style="color:${COLORS.textLight};font-size:12px;padding:12px 0;grid-column:1/-1">Only one run so far</div>`}
    </div>
  </div>

  <!-- ── Bottom two-col: Issues | Bot Log + Commits ─────────── -->
  <div class="bottom-two">

    <!-- Issues -->
    <div class="section">
      <div class="sec-title">📋 Issue Queue
        <span class="cnt">${issues.pending.length} pending</span>
        <span style="background:#F0EBE3;color:#8E8E9A;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800">${issues.skipped.length} skipped</span>
        <span class="cnt3">${issues.done.length} done</span>
      </div>
      ${issuesHtml}
    </div>

    <!-- Bot + Git -->
    <div>
      <div class="section" style="margin-bottom:16px">
        <div class="sec-title">🤖 Bot Log</div>
        <div class="logbox">${botLogHtml || '<span style="color:#555;font-size:11px">No log data</span>'}</div>
        <div style="font-size:10px;color:#8E8E9A;margin-top:6px">${bot.totalLines} total lines · 409 conflicts: ${bot.conflicts}</div>
      </div>
      ${git.log.length ? `
      <div class="section">
        <div class="sec-title">🗂 Recent Commits <span class="meta">${esc(git.branch)}</span></div>
        ${gitHtml}
      </div>` : ''}
    </div>

  </div>
</div><!-- /wrap -->

<script>
  // ── Auto-refresh countdown (paused while pipeline runs) ──────
  let autoRefreshT = 60;
  const cdEl = document.getElementById('cd');
  const autoRefreshTimer = setInterval(() => {
    if (pipelineActive) { autoRefreshT = 60; cdEl.textContent = ''; return; }
    autoRefreshT--;
    if (autoRefreshT <= 15) cdEl.textContent = 'Refresh in ' + autoRefreshT + 's';
    if (autoRefreshT <= 0) location.reload();
  }, 1000);

  // ── State ────────────────────────────────────────────────────
  let pipelineActive = ${pipelineRunning};
  let livePoller     = null;

  // ── Client-side stage card renderer ─────────────────────────
  const STAGE_DEFS_JS = [
    {id:'queue',   label:'Queue Sync',  icon:'📋'},
    {id:'sentry',  label:'Sentry',      icon:'🛡️'},
    {id:'changes', label:'Changes',     icon:'🔍'},
    {id:'scan',    label:'Secret Scan', icon:'🔒'},
    {id:'ci',      label:'Local CI',    icon:'🧪'},
    {id:'push',    label:'Git Push',    icon:'🚀'},
    {id:'actions', label:'GH Actions',  icon:'⚙️'},
    {id:'notify',  label:'Telegram',    icon:'📱'},
  ];
  const STAGE_STYLE_JS = {
    pass:    {border:'#00C9A7', bg:'#E0FFF8', badge:'✅'},
    fail:    {border:'#FF6B8A', bg:'#FFE8EC', badge:'❌'},
    skip:    {border:'#E8E4DE', bg:'#FAFAF8', badge:'·'},
    warn:    {border:'#FFB347', bg:'#FFF3E0', badge:'⚠️'},
    running: {border:'#6C63FF', bg:'#E8E6FF', badge:'⏳'},
  };
  const CONNECTOR_HTML = '<div class="stage-connector"><div class="stage-connector-line"></div></div>';

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderStageCard(st) {
    const sty  = STAGE_STYLE_JS[st.status] || STAGE_STYLE_JS.skip;
    const muted = st.status === 'skip';
    const spin  = st.status === 'running' ? 'animation:runpulse 1.5s infinite' : '';
    return '<div class="stage-card" style="border:2px solid '+sty.border+';background:'+sty.bg+';opacity:'+(muted?.5:1)+';'+spin+'">'
      + '<div style="width:30px;height:30px;border-radius:9px;background:'+sty.border+'22;display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:6px;flex-shrink:0">' + st.icon + '</div>'
      + '<div style="font-size:9.5px;font-weight:800;color:'+(muted?'#B0A898':'#2D2D3A')+';letter-spacing:.1px;text-align:center;line-height:1.3;margin-bottom:3px">' + escHtml(st.label) + '</div>'
      + (st.desc
          ? '<div style="font-size:8.5px;color:'+(muted?'#C8C0B8':'#8E8E9A')+';text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">' + escHtml(st.desc) + '</div>'
          : '<div style="height:11px"></div>')
      + '<div style="margin-top:6px;font-size:13px;line-height:1">' + sty.badge + '</div>'
      + '</div>';
  }

  function renderFlow(stages) {
    return '<div class="pipeline-flow">'
      + stages.map((s,i) => renderStageCard(s) + (i < stages.length-1 ? CONNECTOR_HTML : '')).join('')
      + '</div>';
  }

  // ── Update Latest Run section live ───────────────────────────
  function applyLiveRun(data) {
    const flowEl  = document.getElementById('live-pipeline-flow');
    const logEl   = document.getElementById('live-log-strip');
    const labelEl = document.getElementById('latest-run-label');
    const badgeEl = document.getElementById('latest-run-badge');

    if (!flowEl) return;

    // Stage flow
    if (data.stages && data.stages.length) {
      flowEl.innerHTML = renderFlow(data.stages);
    }

    // Recent log lines
    if (data.recentLines && data.recentLines.length) {
      logEl.style.display = 'block';
      logEl.innerHTML = data.recentLines.map(l => {
        const c = l.includes('❌')||l.includes('error')||l.includes('fatal') ? '#CC3355'
                : l.includes('✅')||l.includes('complete')||l.includes('🎉') ? '#007A60'
                : l.includes('⏳')||l.includes('Waiting') ? '#996600'
                : '#4A4470';
        return '<div style="color:'+c+'">' + escHtml(l) + '</div>';
      }).join('');
    }

    // Title + badge
    if (data.running) {
      labelEl.textContent = '⏳ Running Now';
      badgeEl.innerHTML   = '<span style="background:#E8E6FF;color:#6C63FF;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">⏳ Running</span>';
    } else {
      // Determine final status from stages
      const hasFail = data.stages && data.stages.some(s => s.status === 'fail');
      const hasPass = data.stages && data.stages.some(s => s.status === 'pass');
      if (hasFail) {
        labelEl.textContent = '🔄 Latest Run';
        badgeEl.innerHTML   = '<span style="background:#FFE8EC;color:#FF6B8A;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">❌ Error</span>';
      } else if (hasPass) {
        labelEl.textContent = '🔄 Latest Run';
        badgeEl.innerHTML   = '<span style="background:#E0FFF8;color:#00C9A7;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ Success</span>';
      }
    }
  }

  // ── Polling loop ─────────────────────────────────────────────
  function startLivePolling() {
    if (livePoller) clearInterval(livePoller);
    livePoller = setInterval(async () => {
      try {
        const r    = await fetch('/api/live-run');
        const data = await r.json();
        applyLiveRun(data);
        if (!data.running) {
          stopLivePolling();
          setRunBtn(false);
          // Reload full page after a moment so history updates
          setTimeout(() => location.reload(), 2800);
        }
      } catch {}
    }, 1200);
  }

  function stopLivePolling() {
    if (livePoller) { clearInterval(livePoller); livePoller = null; }
  }

  // ── Button state ─────────────────────────────────────────────
  function setRunBtn(running) {
    const btn = document.getElementById('runBtn');
    pipelineActive = running;
    if (running) {
      btn.textContent  = '⏳ Running…';
      btn.style.color  = '#FFB347';
      btn.disabled     = true;
    } else {
      btn.textContent  = '▶ Run Pipeline';
      btn.style.color  = '#FF6B8A';
      btn.disabled     = false;
    }
  }

  // ── Kick off run ─────────────────────────────────────────────
  async function runPipeline() {
    if (pipelineActive) return;
    setRunBtn(true);

    // Show an immediate "starting" state with all stages pending
    const pendingStages = STAGE_DEFS_JS.map((s,i) => ({...s, status: i===0?'running':'skip', desc:''}));
    const flowEl = document.getElementById('live-pipeline-flow');
    const logEl  = document.getElementById('live-log-strip');
    const label  = document.getElementById('latest-run-label');
    const badge  = document.getElementById('latest-run-badge');
    if (flowEl) flowEl.innerHTML = renderFlow(pendingStages);
    if (logEl)  { logEl.style.display='block'; logEl.innerHTML='<div style="color:#6C63FF">🍼 Triggering pipeline…</div>'; }
    if (label)  label.textContent = '⏳ Running Now';
    if (badge)  badge.innerHTML = '<span style="background:#E8E6FF;color:#6C63FF;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">⏳ Running</span>';

    try {
      const r    = await fetch('/api/run-pipeline', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        if (logEl) logEl.innerHTML += '<div style="color:#CC3355">❌ ' + escHtml(data.error||'Failed to start') + '</div>';
        setRunBtn(false);
        return;
      }
      // Start polling to update stage cards in real time
      startLivePolling();
    } catch(e) {
      if (logEl) logEl.innerHTML += '<div style="color:#CC3355">❌ ' + escHtml(e.message) + '</div>';
      setRunBtn(false);
    }
  }

  // On load: if pipeline was already running when page rendered, start polling immediately
  if (pipelineActive) {
    setRunBtn(true);
    startLivePolling();
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

  // ── Live run stages (poll during manual trigger) ──────────────
  if (req.url === '/api/live-run') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-cache'});
    try { res.end(JSON.stringify(parseLiveRun())); }
    catch(e) { res.end(JSON.stringify({ error: e.message })); }
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

    // Snapshot log size BEFORE spawning — stream will start from here
    const LOG_FILE = path.join(BOT_DIR, 'pipeline.log');
    try { pipelineLogOffset = fs.statSync(LOG_FILE).size; } catch { pipelineLogOffset = 0; }

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
    res.end(JSON.stringify({ ok: true, pid: child.pid, started: pipelineStarted, logOffset: pipelineLogOffset }));
    return;
  }

  // ── Live log tail via SSE (/api/log-stream?from=OFFSET) ──────
  if (req.url.startsWith('/api/log-stream')) {
    const LOG_FILE = path.join(BOT_DIR, 'pipeline.log');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Parse ?from= offset — only stream lines written after this byte position
    const fromParam = new URL(req.url, 'http://localhost').searchParams.get('from');
    let lastSize = fromParam !== null ? parseInt(fromParam, 10) : pipelineLogOffset;
    // Clamp to actual file size in case log rolled
    try {
      const s = fs.statSync(LOG_FILE).size;
      if (lastSize > s) lastSize = s;
    } catch {}

    // Send separator so it's clear this is a fresh run
    res.write(`data: ${JSON.stringify('__sep__')}\n\n`);

    const watcher = setInterval(() => {
      try {
        const stat = fs.statSync(LOG_FILE);
        if (stat.size > lastSize) {
          const len = stat.size - lastSize;
          const buf = Buffer.alloc(len);
          const fd  = fs.openSync(LOG_FILE, 'r');
          fs.readSync(fd, buf, 0, len, lastSize);
          fs.closeSync(fd);
          lastSize = stat.size;
          buf.toString('utf8').split('\n').filter(Boolean)
            .forEach(l => res.write(`data: ${JSON.stringify(l)}\n\n`));
        }
        // Heartbeat with current pipeline status
        res.write(`data: ${JSON.stringify('__status:' + JSON.stringify({running:pipelineRunning,pid:pipelinePid}))}\n\n`);
      } catch {}
    }, 600);

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
