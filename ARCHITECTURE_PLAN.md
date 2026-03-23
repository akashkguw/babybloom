# BabyBloom Architecture Revamp Plan

## Current State

BabyBloom is a feature-rich PWA packed into a single 2,537-line `index.html` using React 18 via CDN with `React.createElement` — no JSX, no build step. It has a Telegram bot for user feedback, a `pipeline.sh` for automated deployments, and a `WORKER_SKILL.md` that lets Claude autonomously implement GitHub issues. Tests work by regex-extracting functions from the HTML and `eval()`-ing them in Node.

This works, but it has real costs: every edit requires understanding 2,500+ lines of context, the LLM worker burns tokens reading the entire file, tests are fragile, and there's no type safety or linting.

---

## What We're Building

A **Vite + TypeScript + React** modular codebase that keeps everything BabyBloom is today — offline-first PWA, zero server calls, IndexedDB storage, voice logging, Siri Shortcuts — while making it maintainable, testable, and LLM-efficient.

---

## Build System: Vite

Vite wins over Webpack (too slow, too verbose), esbuild (no PWA plugin), and Parcel (less control). The reasons that matter for BabyBloom:

- Sub-second rebuilds during development (critical for LLM worker iteration speed)
- `vite-plugin-pwa` handles service worker generation and cache versioning automatically — no more manual `CACHE_NAME = 'babybloom-v26'` bumps
- Tree-shaking brings the bundle from ~240KB to ~160KB gzipped
- TypeScript + JSX out of the box with `@vitejs/plugin-react`

---

## Directory Structure

```
babybloom/
├── src/
│   ├── index.tsx                    # Entry point
│   ├── App.tsx                      # Root component + tab routing
│   ├── main.css                     # Global styles + theme CSS variables
│   │
│   ├── components/
│   │   ├── shared/                  # Reusable UI primitives
│   │   │   ├── Icon.tsx             # SVG icon component (replaces IP + Ic)
│   │   │   ├── Card.tsx             # Card wrapper (replaces Cd)
│   │   │   ├── Button.tsx           # Styled button (replaces Btn)
│   │   │   ├── Input.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Pill.tsx
│   │   │   └── ProgressCircle.tsx
│   │   ├── charts/
│   │   │   ├── BarChart.tsx         # Custom SVG bar chart
│   │   │   └── GrowthChart.tsx      # WHO percentile curves
│   │   └── modals/
│   │       ├── SearchModal.tsx
│   │       └── SettingsModal.tsx
│   │
│   ├── tabs/                        # Page-level smart components
│   │   ├── HomeTab.tsx
│   │   ├── LogTab.tsx
│   │   ├── MilestonesTab.tsx
│   │   ├── GuideTab.tsx
│   │   ├── SafetyTab.tsx
│   │   └── StatsTab.tsx
│   │
│   ├── features/                    # Feature-specific logic + UI
│   │   ├── voice/
│   │   │   ├── VoiceButton.tsx
│   │   │   ├── parseVoice.ts        # Pure function — testable, no React
│   │   │   └── useVoiceRecognition.ts
│   │   ├── feeding/
│   │   │   ├── TimerView.tsx
│   │   │   ├── mergeFeedSession.ts  # Pure function
│   │   │   └── useFeedingTimer.ts
│   │   ├── profiles/
│   │   │   ├── ProfileManager.tsx
│   │   │   └── useProfileData.ts
│   │   └── shortcuts/
│   │       ├── SiriShortcutsSetup.tsx
│   │       └── handleShortcutAction.ts
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── indexeddb.ts         # Typed wrapper (replaces odb/dg/ds/dga/dcl)
│   │   │   └── schema.ts           # DB constants + TypeScript interfaces
│   │   ├── utils/
│   │   │   ├── volume.ts           # ozToMl, mlToOz, fmtVol
│   │   │   ├── date.ts             # daysAgo, aggregateLogs
│   │   │   └── formatting.ts       # fmtTime, fmtDate, monthLabel
│   │   ├── hooks/
│   │   │   ├── useTheme.ts         # Dark/light mode
│   │   │   └── useNotification.ts  # Toast system
│   │   └── constants/
│   │       ├── colors.ts           # C_LIGHT, C_DARK theme objects
│   │       ├── icons.ts            # SVG path data
│   │       ├── milestones.ts       # CDC milestone data
│   │       ├── vaccines.ts         # Vaccine schedule
│   │       └── guides.ts           # Static guide content
│   │
│   ├── context/
│   │   ├── AppContext.tsx           # Global state (theme, active tab)
│   │   ├── ProfileContext.tsx       # Active baby profile
│   │   └── LogsContext.tsx          # Log data + persistence
│   │
│   └── styles/
│       ├── base.css                 # Reset + typography
│       └── theme.css                # CSS custom properties for theming
│
├── tests/
│   ├── unit/
│   │   ├── volume.test.ts
│   │   ├── parseVoice.test.ts
│   │   ├── mergeFeed.test.ts
│   │   └── date.test.ts
│   ├── integration/
│   │   ├── app.test.tsx
│   │   ├── profile-switching.test.tsx
│   │   └── voice-to-log.test.tsx
│   └── e2e/                         # Optional, for Siri shortcuts etc.
│       └── siri-shortcuts.cy.ts
│
├── bot/                             # Unchanged (Telegram + pipeline)
│   ├── WORKER_SKILL.md              # Updated for modular codebase
│   ├── bot.js
│   ├── pipeline.sh
│   └── ...
│
├── .github/workflows/
│   ├── test.yml                     # vitest + type-check + lint + build
│   └── deploy.yml                   # Build → GitHub Pages
│
├── public/
│   └── logo.svg                     # PWA icon
│
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── .eslintrc.json
├── .prettierrc
└── .gitignore
```

### Design Principles

**Separation by feature, not file type.** All voice-related code lives in `features/voice/` — the component, the parsing logic, and the hook. You don't hunt across `components/`, `utils/`, and `hooks/` to understand one feature.

**Pure logic separate from React.** Everything in `lib/` has zero React dependencies. `parseVoice.ts`, `ozToMl()`, `mergeFeedSession()` are plain TypeScript functions you can import and test without rendering anything.

**Max 400 lines per file.** This is the sweet spot for both human readability and LLM context efficiency. The current 2,537-line monolith becomes ~15-20 focused files.

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.1.0",
    "typescript": "^5.4.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite-plugin-pwa": "^0.18.0",
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^23.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

No state management library needed — React Context is sufficient for BabyBloom's use case. If complexity grows later, Zustand (~3KB) is the right upgrade.

---

## PWA & Offline Strategy

The current hand-written `sw.js` requires manual version bumps on every change. With `vite-plugin-pwa`:

- Service worker is **generated** from build, with content hashes for automatic cache busting
- `registerType: 'autoUpdate'` handles SW updates without user intervention
- Precaching of all JS/CSS chunks happens automatically
- `injectManifest` strategy lets us keep custom cache logic if needed
- IndexedDB persistence is completely unaffected — same schema, same API

The PWA manifest moves to `vite.config.ts` and is generated at build time, eliminating the separate `manifest.json` file.

---

## Testing Strategy

### What Changes

| Aspect | Current | New |
|--------|---------|-----|
| Framework | Custom `test()` + regex extraction + `eval()` | Vitest + React Testing Library |
| Unit tests | Extract functions from HTML via regex | Import directly from TypeScript modules |
| Integration | None | Component render tests with jsdom |
| CI validation | String matching (`html.includes(...)`) | TypeScript compilation + test suite |
| Coverage | Unknown | Tracked with `@vitest/coverage-v8` |

### What Stays

All 50+ existing test cases (volume conversions, voice parsing, feed merging, time formatting) are preserved as proper Vitest tests. The logic they test is identical — only the test harness changes.

---

## CI/CD Pipeline

### `.github/workflows/test.yml` (replaces current)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run type-check     # TypeScript compilation
      - run: npm run lint            # ESLint
      - run: npm run test -- --run   # Vitest (no watch mode in CI)
      - run: npm run build           # Vite production build
```

### `.github/workflows/deploy.yml` (new)

Triggers on push to `main`, runs `npm run build`, deploys `dist/` to GitHub Pages via `peaceiris/actions-gh-pages`.

---

## WORKER_SKILL.md Updates

The LLM worker's workflow improves dramatically:

**Before:** Read all 2,537 lines → grep for relevant section → edit inline → bump SW version → regex-based tests

**After:** Read issue → identify feature directory (200-400 lines) → edit focused files → run `npm test` → commit. No manual SW versioning needed.

Key changes to the skill:
- `grep -r "keyword" src/features/` replaces grepping the entire HTML
- Edits target specific `.ts`/`.tsx` files instead of line ranges in `index.html`
- `npm run test` replaces `node tests/regression.js`
- `npm run build` replaces manual `sw.js` version bump
- New tests can be added alongside implementation (not prohibited like before)
- Hard limit on editing only `src/` and `tests/` directories

---

## Pre-Change Checklist (Before Any Migration Work)

- [ ] Tag current working state: `git tag v1.0-monolith`
- [ ] Verify all 50 regression tests pass on current codebase
- [ ] Document current IndexedDB schema and data shapes
- [ ] Capture current Lighthouse scores as baseline
- [ ] Ensure `pipeline.sh` and bot are paused during migration
- [ ] Back up `pending-issues.json` state

## During-Change Guidelines

- [ ] One module at a time — extract, test, verify, commit
- [ ] Every extracted module must have corresponding unit tests before moving on
- [ ] Run full test suite after every module extraction
- [ ] Keep the old `index.html` functional until Phase 4 is complete (parallel operation)
- [ ] No new features during migration — only restructuring
- [ ] Commit messages follow: `refactor: Extract {module} from monolith`

## Post-Change Validation

- [ ] All original 50+ test cases pass in new Vitest suite
- [ ] Lighthouse PWA score >= current baseline
- [ ] Bundle size < 180KB gzipped (vs current ~240KB)
- [ ] Offline mode works: airplane mode → full app functional
- [ ] Install as PWA on iOS Safari and Android Chrome
- [ ] Voice logging works in Chrome, Safari, Edge
- [ ] Siri Shortcuts URL scheme still functional
- [ ] Dark mode toggle works
- [ ] Profile switching preserves data isolation
- [ ] Export/import JSON backup works
- [ ] Feed merge detection works within 30-minute window
- [ ] LLM worker can implement a test issue using updated WORKER_SKILL.md

---

## Migration Phases

### Phase 1: Foundation (Days 1-2)
Set up Vite, TypeScript, ESLint, Prettier. Create `src/` structure. Extract constants (`colors.ts`, `icons.ts`, `milestones.ts`, `vaccines.ts`). Wire up `vite-plugin-pwa`. Get a blank app building and deploying.

### Phase 2: Pure Logic (Days 3-5)
Extract all pure utility functions into `lib/utils/` and `lib/db/`. Write Vitest unit tests for each. This is the safest phase — these functions have zero UI dependencies and are directly testable.

### Phase 3: UI Primitives (Days 6-8)
Extract shared components (Button, Card, Icon, Input, etc.) into `components/shared/`. These are the building blocks used by every tab and feature.

### Phase 4: Features (Days 9-14)
Extract feature modules one at a time: voice, feeding/timer, profiles, shortcuts, settings. Each gets its own directory with component + logic + hook + tests.

### Phase 5: Tabs & App Shell (Days 15-17)
Extract tab components and wire up `App.tsx` with the tab navigation system. At this point the old `index.html` is fully replaced by the modular build.

### Phase 6: CI/CD & Worker (Days 18-20)
Update GitHub Actions, deploy pipeline, and `WORKER_SKILL.md`. Test the full automated flow: Telegram message → GitHub issue → LLM worker implements in modular codebase → pipeline deploys.

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Largest file | 2,537 lines | ~400 lines |
| LLM context per feature edit | ~2,500 lines | ~200-400 lines |
| Build time | N/A (no build) | ~3s production build |
| Bundle size | ~240KB | ~160KB gzipped |
| Test execution | ~15s (regex + eval) | ~5s (Vitest) |
| Type safety | None | Full TypeScript |
| SW version management | Manual bump | Automatic content hash |
| Developer onboarding | Read 2,500 lines | Read one feature directory |
