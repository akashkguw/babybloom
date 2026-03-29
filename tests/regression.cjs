#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  BabyBloom Regression Test Suite
//  Tests actual function behavior extracted from index.html
//  Run: node tests/regression.js
// ═══════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0, skip = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  ✅", name);
    pass++;
  } catch (e) {
    console.log("  ❌ FAIL:", name);
    console.log("     →", e.message);
    fail++;
  }
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function ok(val, msg) {
  if (!val) throw new Error(msg || `expected truthy, got ${JSON.stringify(val)}`);
}

// ─── Detect architecture: Vite (src/) vs legacy single-file (index.html) ───
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const isViteApp = html.includes('type="module"') && html.includes('/src/');
let sw = "";
try { sw = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8"); } catch { /* Vite apps may not have sw.js */ }

// Pull out the constants and pure utility functions we can test in Node
// (only works for legacy single-file architecture)
const ML_PER_OZ = 29.5735;
if (!isViteApp) {
  eval(`
  const ML_PER_OZ = ${ML_PER_OZ};
  ${html.match(/function ozToMl.*/)   ?.[0] || ""}
  ${html.match(/function mlToOz.*/)   ?.[0] || ""}
  ${html.match(/function fmtVol.*/)   ?.[0] || ""}
  ${html.match(/function volLabel.*/) ?.[0] || ""}
  ${html.match(/function fmtTime.*/)  ?.[0] || ""}
  ${html.match(/function fmtDate.*/)  ?.[0] || ""}
  ${html.match(/function monthLabel.*/) ?.[0] || ""}
  `);
}

// Extract parseVoice (multi-line)
const pvStart = html.indexOf("function parseVoice(");
const pvBlock = extractFunction(html, pvStart);
if (pvBlock) eval(pvBlock);

function extractFunction(src, start) {
  if (start === -1) return null;
  let depth = 0, i = start;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
    i++;
  }
  return null;
}

// ═══════════════════════════════════════
console.log("\n🍼 BabyBloom Regression Tests\n");

if (isViteApp) {
  console.log("  ℹ️  Vite/React architecture detected — skipping legacy index.html extraction tests");
  console.log("  ℹ️  Volume, time, and voice tests are covered by vitest (npm run test)\n");
} else {
  // ─── Volume conversions (legacy) ───
  console.log("📐 Volume conversions:");
  test("ozToMl: 1 oz → ~29.6 ml", () => eq(ozToMl(1), 29.6));
  test("ozToMl: 0 oz → 0 ml",     () => eq(ozToMl(0), 0));
  test("ozToMl: null → 0",        () => eq(ozToMl(null), 0));
  test("mlToOz: 29.5735 ml → 1 oz", () => eq(mlToOz(29.5735), 1));
  test("mlToOz: 0 → 0",           () => eq(mlToOz(0), 0));
  test("mlToOz: 100 ml → ~3.4 oz", () => eq(mlToOz(100), 3.4));
  test("ozToMl then mlToOz roundtrip", () => eq(mlToOz(ozToMl(5)), 5));

  // ─── Volume formatting (legacy) ───
  console.log("\n📏 Volume formatting:");
  test("fmtVol: 2 oz in oz mode",       () => eq(fmtVol(2, "oz"), "2 oz"));
  test("fmtVol: 2 oz in ml mode",       () => eq(fmtVol(2, "ml"), "59 ml"));
  test("fmtVol: 0 in oz shows '0 oz'",  () => eq(fmtVol(0, "oz"), "0 oz"));
  test("fmtVol: null → empty string",   () => eq(fmtVol(null, "oz"), ""));
  test("fmtVol: undefined → empty",     () => eq(fmtVol(undefined, "oz"), ""));
  test("volLabel ml",              () => eq(volLabel("ml"), "ml"));
  test("volLabel oz",              () => eq(volLabel("oz"), "oz"));

  // ─── Time formatting (legacy) ───
  console.log("\n🕐 Time formatting:");
  test("fmtTime: 09:30 → 9:30 AM",  () => eq(fmtTime("09:30"), "9:30 AM"));
  test("fmtTime: 13:00 → 1:00 PM",  () => eq(fmtTime("13:00"), "1:00 PM"));
  test("fmtTime: 00:00 → 12:00 AM", () => eq(fmtTime("00:00"), "12:00 AM"));
  test("fmtTime: 12:00 → 12:00 PM", () => eq(fmtTime("12:00"), "12:00 PM"));
  test("fmtTime: empty string → empty", () => eq(fmtTime(""), ""));
  test("fmtTime: null → empty",     () => eq(fmtTime(null), ""));

  // ─── Voice parsing (legacy) ───
  console.log("\n🎤 Voice parsing:");
  if (typeof parseVoice === "function") {
    test("parseVoice: bottle 3 oz",     () => { const r = parseVoice("bottle 3 oz"); eq(r?.cat, "feed"); eq(r?.entry?.type, "Bottle"); eq(r?.entry?.oz, 3); });
    test("parseVoice: breast left 10 min", () => { const r = parseVoice("breast left 10 minutes"); eq(r?.cat, "feed"); eq(r?.entry?.type, "Breast L"); });
    test("parseVoice: breast right",    () => { const r = parseVoice("nursed right 8 min"); eq(r?.cat, "feed"); eq(r?.entry?.type, "Breast R"); });
    test("parseVoice: wet diaper",      () => { const r = parseVoice("wet diaper"); eq(r?.cat, "diaper"); eq(r?.entry?.type, "Wet"); });
    test("parseVoice: dirty diaper",    () => { const r = parseVoice("poop"); eq(r?.cat, "diaper"); eq(r?.entry?.type, "Dirty"); });
    test("parseVoice: sleep",           () => { const r = parseVoice("sleeping"); eq(r?.cat, "sleep"); });
    test("parseVoice: wake",            () => { const r = parseVoice("woke up"); eq(r?.cat, "sleep"); });
    test("parseVoice: formula ml",      () => { const r = parseVoice("formula 90 ml"); eq(r?.cat, "feed"); ok(r?.entry?.oz > 0, "oz should be converted from ml"); });
    test("parseVoice: unrecognized → null", () => eq(parseVoice("hello world"), null));
  } else {
    console.log("  ⚠️  parseVoice not extracted — skipping voice tests");
    skip += 9;
  }

  // ─── SW cache version (legacy) ───
  console.log("\n🔧 Service Worker:");
  test("SW has cache version string", () => ok(/babybloom-v\d+/.test(sw), "No babybloom-vN found in sw.js"));
  test("SW cache version is a number", () => {
    const v = parseInt((sw.match(/babybloom-v(\d+)/) || [])[1]);
    ok(v >= 1, `SW version should be >= 1, got ${v}`);
  });
  test("SW cache version is >= 21 (never regressed)", () => {
    const v = parseInt((sw.match(/babybloom-v(\d+)/) || [])[1]);
    ok(v >= 21, `SW version should be >= 21, got ${v} — version may have been reset`);
  });

  // ─── Feature presence (legacy single-file) ───
  console.log("\n🔍 Feature regression guards (legacy):");
  const features = [
    ["Feed merge logic",       "mergeIntoLastFeed"],
    ["Continue Last Feed btn", "getRecentFeed", "Continue \"+rf.type"],
    ["Firsts edit",            "updateFirst"],
    ["Firsts delete",          "deleteFirst"],
    ["Profile switching",      "switchProfile"],
    ["Dark mode colors",       "C_DARK"],
    ["Voice input",            "SpeechRecognition"],
    ["Siri Shortcuts",         "SiriShortcutsSetup"],
    ["Massage guide",          "MASSAGE_GUIDE"],
    ["Vaccine tracker",        "VaccineTab", "vaccine"],
    ["IndexedDB ds()",         "function ds("],
    ["IndexedDB dg()",         "function dg("],
    ["React createElement alias", "h=R.createElement"],
    ["Service worker reg",     "serviceWorker.register"],
  ];

  features.forEach(([name, ...patterns]) => {
    test(name, () => ok(
      patterns.some(p => html.includes(p)),
      `None of [${patterns.join(", ")}] found in index.html`
    ));
  });
}

// ─── Vite/React source file regression guards (post-refactor) ───
console.log("\n📂 Source file regression guards:");

function readSrc(rel) {
  try { return fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8"); }
  catch { return null; }
}

const searchModal = readSrc("components/modals/SearchModal.tsx");
const baseCss = readSrc("styles/base.css");
const appTsx = readSrc("App.tsx");
const logTab = readSrc("tabs/LogTab.tsx");
const milestonesTab = readSrc("tabs/MilestonesTab.tsx");

if (searchModal) {
  test("Search covers 'tummy' log type", () => ok(searchModal.includes("'tummy'"), "tummy missing from search logTypes"));
  test("Search covers 'massage' log type", () => ok(searchModal.includes("'massage'"), "massage missing from search logTypes"));
  test("Search does NOT include 'pump' (non-existent)", () => ok(!searchModal.includes("'pump'"), "pump found in search logTypes but type doesn't exist"));
  test("Search imports MILESTONES", () => ok(searchModal.includes("MILESTONES"), "MILESTONES not imported in SearchModal"));
  test("Search queries milestone red flags", () => ok(searchModal.includes("m.red"), "Red flag search missing"));
  test("Search extracts e.subType field", () => ok(searchModal.includes("e.subType"), "e.subType not extracted for search"));
  test("Search extracts e.side field", () => ok(searchModal.includes("e.side"), "e.side not extracted for search"));
  test("Search extracts e.head field", () => ok(searchModal.includes("e.head"), "e.head not extracted for search"));
} else {
  console.log("  ⚠️  SearchModal.tsx not found — skipping search guards");
  skip += 8;
}

if (baseCss) {
  test("Header is full viewport width (left: 0, right: 0)", () => {
    const hdr = baseCss.slice(baseCss.indexOf(".app-header"), baseCss.indexOf("}", baseCss.indexOf(".app-header")) + 1);
    ok(hdr.includes("left: 0") && hdr.includes("right: 0"), "app-header should use left:0/right:0 for full width");
  });
  test("Header has no max-width: 430", () => {
    const hdr = baseCss.slice(baseCss.indexOf(".app-header"), baseCss.indexOf("}", baseCss.indexOf(".app-header")) + 1);
    ok(!hdr.includes("max-width: 430") && !hdr.includes("max-width:430"), "app-header should not have max-width: 430");
  });
  test("Header uses safe-area-inset-top", () => ok(baseCss.includes("env(safe-area-inset-top"), "Missing safe-area-inset-top"));
  test(".ca has overflow-y: auto", () => ok(/\.ca[\s\S]*?overflow-y:\s*auto/.test(baseCss), ".ca must have overflow-y: auto"));
  test("No -webkit-overflow-scrolling (deprecated)", () => ok(!baseCss.includes("-webkit-overflow-scrolling"), "Deprecated -webkit-overflow-scrolling found"));
} else {
  console.log("  ⚠️  base.css not found — skipping layout guards");
  skip += 5;
}

if (appTsx) {
  test("Main container maxWidth is 500 (not 430)", () => {
    ok(appTsx.includes("maxWidth: 500"), "maxWidth should be 500");
    ok(!appTsx.match(/maxWidth:\s*430/), "maxWidth 430 is too narrow for Pro Max");
  });
  test("No borderBottom on app-header", () => {
    const hdrIdx = appTsx.indexOf('className="app-header"');
    if (hdrIdx > -1) {
      const region = appTsx.slice(Math.max(0, hdrIdx - 200), hdrIdx + 300);
      ok(!region.includes("borderBottom"), "app-header should not have borderBottom");
    }
  });
} else {
  console.log("  ⚠️  App.tsx not found — skipping App guards");
  skip += 2;
}

// Modal-outside-scroll invariant: .mo must not be inside .ca
function checkModalNotInCa(src, name) {
  if (!src) { console.log(`  ⚠️  ${name} not found — skipping`); skip++; return; }
  test(`${name}: modal (.mo) not nested inside .ca scroll container`, () => {
    const caIdx = src.indexOf('className="ca"');
    const moIdx = src.indexOf('className="mo"');
    if (caIdx === -1 || moIdx === -1) return; // no modal or no .ca — OK
    const between = src.slice(caIdx, moIdx);
    const opens = (between.match(/<div[\s>]/g) || []).length;
    const closes = (between.match(/<\/div>/g) || []).length;
    ok(closes >= opens, `In ${name}, .mo is nested inside .ca — iOS fixed-position bug!`);
  });
}
checkModalNotInCa(logTab, "LogTab");
checkModalNotInCa(milestonesTab, "MilestonesTab");

// ─── No corruption markers ───
console.log("\n🛡️  Integrity checks:");
test("No merge conflict markers", () => ok(!html.includes("<<<<<<<"), "Found <<<<<<< in index.html"));
test("No leftover TODOs",         () => ok(!html.includes("TODO:"), "Found TODO: in index.html"));
test("Valid HTML structure",      () => ok(html.includes("</html>"), "index.html missing </html>"));
if (isViteApp) {
  test("Vite entry point present", () => ok(html.includes('/src/index.tsx') || html.includes('/src/main.tsx'), "Vite entry point missing"));
} else {
  test("React CDN present",         () => ok(html.includes("react") && html.includes("https://"), "React CDN link missing"));
}

// ═══════════════════════════════════════
const total = pass + fail + skip;
console.log(`\n${"═".repeat(40)}`);
console.log(`Results: ${pass}/${total} passed${skip > 0 ? `, ${skip} skipped` : ""}`);
if (fail > 0) {
  console.log(`\n🚨 ${fail} test(s) FAILED — do not deploy until fixed\n`);
  process.exit(1);
} else {
  console.log(`\n✅ All tests passed — safe to deploy\n`);
}
