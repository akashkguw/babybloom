#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BabyBloom Local CI
#  Three stages: unit tests → build → server smoke test
#  Exit 0 = all clear.  Exit 1 = blocked.
# ═══════════════════════════════════════════════════════════════

REPO_DIR="${1:-/Users/akashkg/saanvi/babybloom}"
PREVIEW_PORT=4174
PREVIEW_PID=""
FAILED=0

# ─── Fix PATH so node/npm/npx are always found ────────────────
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
NVM_NODE=$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1)
[ -n "$NVM_NODE" ] && export PATH="$HOME/.nvm/versions/node/$NVM_NODE/bin:$PATH"
BREW_BIN="$(brew --prefix 2>/dev/null)/bin"
[ -d "$BREW_BIN" ] && export PATH="$BREW_BIN:$PATH"

cd "$REPO_DIR" || { echo "❌ Repo dir not found: $REPO_DIR"; exit 1; }

if ! command -v node &>/dev/null; then
  echo "❌ node not found — PATH: $PATH"; exit 1
fi
echo "🔧 node $(node --version)  ·  npm $(npm --version 2>/dev/null)"

# ─── Cleanup on exit ──────────────────────────────────────────
cleanup() {
  [ -n "$PREVIEW_PID" ] && kill "$PREVIEW_PID" 2>/dev/null && wait "$PREVIEW_PID" 2>/dev/null
}
trap cleanup EXIT

# ─── Stage runner ─────────────────────────────────────────────
RESULTS=()
stage_pass() { echo "└─ ✅ $1 passed";  RESULTS+=("pass:$1"); }
stage_fail() { echo "└─ ❌ $1 FAILED";  RESULTS+=("fail:$1"); FAILED=1; }

# ══════════════════════════════════════════════════════════════
# STAGE 1 — Vitest unit tests
# ══════════════════════════════════════════════════════════════
echo ""
echo "┌─ Unit Tests (vitest)"
if npx vitest run --reporter=verbose 2>&1; then
  stage_pass "Unit Tests"
else
  stage_fail "Unit Tests"
fi

# ══════════════════════════════════════════════════════════════
# STAGE 2 — TypeScript check + Vite build
# ══════════════════════════════════════════════════════════════
echo ""
echo "┌─ TypeScript + Build"
TS_OK=true
BUILD_OK=true

echo "  Checking types…"
if npx tsc --noEmit 2>&1; then
  echo "  Types OK"
else
  echo "  TypeScript errors found"
  TS_OK=false
  FAILED=1
fi

echo "  Building…"
if npx vite build 2>&1; then
  echo "  Build size: $(du -sh dist/ 2>/dev/null | cut -f1)"
  BUILD_OK=true
else
  echo "  Vite build failed"
  BUILD_OK=false
  FAILED=1
fi

if $TS_OK && $BUILD_OK; then
  stage_pass "TypeScript + Build"
else
  stage_fail "TypeScript + Build"
fi

# ══════════════════════════════════════════════════════════════
# STAGE 3 — Preview server smoke test
#   App is served at /babybloom/ (base in vite.config.ts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "┌─ Server Smoke Test"

# Skip if build failed — nothing to serve
if ! $BUILD_OK; then
  echo "  ⏭  Skipping — build did not succeed"
  RESULTS+=("skip:Server Smoke Test")
else

  # Kill anything on our port
  lsof -ti:$PREVIEW_PORT | xargs kill -9 2>/dev/null || true
  sleep 0.5

  # Start preview server
  npx vite preview --port $PREVIEW_PORT --strictPort &>/tmp/babybloom-preview.log &
  PREVIEW_PID=$!
  echo "  Preview server PID $PREVIEW_PID"

  # Wait up to 15s for it to be ready (root redirects to /babybloom/)
  READY=0
  for i in $(seq 1 15); do
    sleep 1
    if curl -sL --max-time 2 "http://localhost:$PREVIEW_PORT/babybloom/" -o /dev/null 2>/dev/null; then
      READY=1
      echo "  Ready after ${i}s"
      break
    fi
    echo "  Waiting… ${i}s"
  done

  if [ $READY -eq 0 ]; then
    echo "  ❌ Server never became ready"
    cat /tmp/babybloom-preview.log
    stage_fail "Server Smoke Test"
  else
    BASE_URL="http://localhost:$PREVIEW_PORT/babybloom"
    DIST="$REPO_DIR/dist"
    SMOKE_FAIL=0

    # ── file_check: verify build output on disk ────────────────
    file_check() {
      local label="$1" file="$2" pattern="$3"
      if [ ! -f "$file" ]; then
        echo "  ❌ $label — file not found: $file"
        SMOKE_FAIL=1
      elif [ -n "$pattern" ] && ! grep -q "$pattern" "$file"; then
        echo "  ❌ $label — '$pattern' not in $(basename "$file")"
        SMOKE_FAIL=1
      else
        echo "  ✅ $label"
      fi
    }

    # ── http_check: verify server responds correctly ───────────
    http_check() {
      local label="$1" url="$2"
      local status
      status=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
      if [ "$status" = "200" ]; then
        echo "  ✅ $label (HTTP $status)"
      else
        echo "  ❌ $label — got HTTP $status, expected 200"
        SMOKE_FAIL=1
      fi
    }

    # Build output checks (no HTTP, just files)
    file_check "index.html has title"     "$DIST/index.html"             'BabyBloom'
    file_check "index.html has root div"  "$DIST/index.html"             'id="root"'
    file_check "JS bundle built"          "$DIST/index.html"             '<script'
    file_check "Manifest built"           "$DIST/manifest.webmanifest"   'BabyBloom'
    file_check "SW built"                 "$DIST/sw.js"                  'babybloom'

    # Server actually responds
    http_check "Server responds 200"       "$BASE_URL/"
    http_check "Assets reachable"         "$BASE_URL/manifest.webmanifest"

    kill "$PREVIEW_PID" 2>/dev/null
    wait "$PREVIEW_PID" 2>/dev/null
    PREVIEW_PID=""

    [ $SMOKE_FAIL -eq 0 ] && stage_pass "Server Smoke Test" || stage_fail "Server Smoke Test"
  fi
fi

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════"
echo "  BabyBloom Local CI — Results"
echo "══════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  s="${r%%:*}"; n="${r#*:}"
  [ "$s" = "pass" ] && echo "  ✅  $n" || echo "  ❌  $n"
done
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All CI stages passed — safe to deploy"
  exit 0
else
  echo "🚨 CI failed — deploy blocked"
  exit 1
fi
