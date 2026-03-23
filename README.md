<p align="center">
  <img src="https://img.shields.io/badge/🍼-BabyBloom-FF6B8A?style=for-the-badge&labelColor=FFF8F0" alt="BabyBloom" />
</p>

<h1 align="center">BabyBloom</h1>

<p align="center">
  <strong>Your complete baby care companion for 0–24 months</strong><br/>
  Evidence-based guidance from AAP, CDC & WHO — right in your pocket.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-Installable-6C63FF?style=flat-square&logo=pwa&logoColor=white" />
  <img src="https://img.shields.io/badge/Works-Offline-00C9A7?style=flat-square" />
  <img src="https://img.shields.io/badge/Data-Local%20Only-FFB347?style=flat-square" />
  <img src="https://img.shields.io/badge/Built%20with-Vite%20+%20React%20+%20TypeScript-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
</p>

---

## What is BabyBloom?

BabyBloom is a free, privacy-first Progressive Web App that helps new parents track their baby's care, growth, and development. All data stays on your device — nothing is ever sent to a server.

Built with Vite, React 18, and TypeScript, BabyBloom deploys to GitHub Pages and works fully offline after the first visit. Install it to your home screen for a native app experience on any device.

**Live App:** [akashkguw.github.io/babybloom](https://akashkguw.github.io/babybloom)

---

## Features

### Daily Tracking
- **Feeding** — Breast (L/R with real-time timer), bottle (ml/oz), solids, and pump sessions with smart session merging
- **Diapers** — Wet, dirty, or both with color, consistency, and pee amount tracking
- **Sleep** — Nap, night sleep, and wake-up with automatic duration calculation
- **Growth** — Weight, height, and head circumference with WHO percentile charts
- **Temperature** — Log readings with fever threshold alerts
- **Bath** — Full bath, sponge bath, or hair wash
- **Massage** — Body part, oil used, duration, and baby's mood with a full best practices guide
- **Medications** — Name, dose, and schedule tracking
- **Allergies** — Food introduction log with reaction tracking

### Quick Log
One-tap logging directly from the home screen — no navigating to forms for frequent actions like diaper changes, naps, and breastfeeding. The inline feed timer starts counting in real time and logs the exact duration when you tap Done.

### Feed Session Merging
BabyBloom detects when you stop a feed timer and there's a recent feed within the last 30 minutes. It asks whether this is part of the same session so you can merge the minutes into one combined entry. A "Continue" button also appears after a recent feed for one-tap resuming after a burp break.

### Voice Logging
Tap the microphone and speak naturally — "bottle 4 ounces," "wet diaper," "nap," "temperature 99.5," "breast left 15 minutes." BabyBloom parses your speech and auto-saves. Powered by the Web Speech API (Chrome, Safari, Edge).

### Siri Shortcuts (iPhone)
Log without opening the app via URL-based shortcuts compatible with Apple's Shortcuts app. Set up one-tap home screen icons or "Hey Siri" voice commands for any log action. Configured in **Settings → Siri Shortcuts**.

### Stats & Insights
Interactive charts with daily, weekly, and monthly views. Toggle between count, duration, and volume for each category.

### Developmental Milestones
Track 100+ milestones across motor, cognitive, social, and language domains from newborn through 24 months — with activity suggestions, tips, and red flags.

### Comprehensive Guide
Vaccines · Sleep · Feeding · Solid Foods · Growth Charts · Activities · Common Remedies · Mom Nutrition · Parent Wellness · Screen Time · Medicine Calculator · Well-Child Visits

### Safety Center
Safe Sleep · Baby-Proofing · Infant CPR · Choking Response · Fever Guide · Emergency Contacts

### Additional Features
- **Feeding Reminders** — Push notifications at configurable intervals
- **Dark Mode** — Easy on the eyes during night feeds
- **Search** — Across logs, milestones, vaccines, and guides
- **Multiple Profiles** — Separate data per child with one-tap switching
- **Pediatrician Report** — Printable health summary
- **Export / Import** — JSON backup and restore
- **Teeth Tracker** — All 20 baby teeth eruption dates
- **Baby Firsts** — Record first smile, first steps, first word, and more

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| PWA | vite-plugin-pwa (auto-update service worker) |
| Storage | IndexedDB (persistent, device-local) |
| Styling | Inline styles with light/dark theme tokens |
| Hosting | GitHub Pages via GitHub Actions CI/CD |
| Icons | Hand-crafted SVG components |
| Charts | Custom SVG bar charts and WHO growth curves |
| Voice | Web Speech API with natural language parser |
| Testing | Vitest |

---

## Project Structure

```
babybloom/
├── src/
│   ├── App.tsx                  # Root component, state, routing
│   ├── index.tsx                # Entry point, SW registration
│   ├── tabs/                    # Top-level tab screens
│   │   ├── HomeTab.tsx          # Dashboard, quick log, feed timer
│   │   ├── LogTab.tsx           # Full log history & editing
│   │   ├── MilestonesTab.tsx    # Milestone tracking
│   │   ├── GuideTab.tsx         # Reference guides
│   │   └── SafetyTab.tsx        # Safety & emergency info
│   ├── features/                # Feature modules
│   │   ├── feeding/             # Feed timer, merge logic, quick sheet
│   │   ├── profiles/            # Multi-profile management
│   │   ├── settings/            # App settings & data export
│   │   ├── shortcuts/           # Siri Shortcuts integration
│   │   ├── stats/               # Charts and summaries
│   │   └── voice/               # Voice recognition & NLP parser
│   ├── components/
│   │   ├── shared/              # Button, Input, Card, Icon, Toast, etc.
│   │   └── modals/              # Search modal
│   └── lib/
│       ├── constants/           # Colors, icons, milestones, guides, i18n
│       ├── db/                  # IndexedDB wrappers (dg/ds)
│       └── utils/               # Volume, time, date helpers
├── bot/
│   ├── bot.js                   # Telegram bot — creates GitHub issues
│   ├── pipeline.sh              # Mac LaunchAgent — push, close issues, notify
│   ├── deploy.sh                # Commit, push, and GitHub issue management
│   ├── WORKER_SKILL.md          # Autonomous Claude worker instructions
│   └── pending-issues.json      # Issue queue (Telegram → GitHub → Claude)
├── .github/workflows/
│   ├── deploy.yml               # Build & deploy to GitHub Pages
│   └── test.yml                 # Type check, lint, test, build on push
├── public/                      # Static assets, icons
├── tests/unit/                  # Vitest unit tests
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## Getting Started

### Use it now

Visit **[akashkguw.github.io/babybloom](https://akashkguw.github.io/babybloom)** and tap "Add to Home Screen" to install as a PWA.

### Run locally

```bash
git clone https://github.com/akashkguw/babybloom.git
cd babybloom
npm install
npm run dev
```

Open `http://localhost:5173/babybloom/` in your browser.

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run type-check` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run preview` | Preview production build locally |

### Deploy your own

1. Fork this repository
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — GitHub Actions builds and deploys automatically
4. Your app will be live at `https://<username>.github.io/babybloom`

---

## Autonomous Bot Pipeline

BabyBloom uses a self-contained automation pipeline:

1. **Telegram Bot** (`bot/bot.js`) — You send feature requests or bug reports via Telegram; the bot creates GitHub issues automatically.
2. **Claude Worker** (Cowork scheduled task) — Runs every 4 hours, reads open issues, implements them in the codebase one by one with full type-checking.
3. **Pipeline** (`bot/pipeline.sh`) — Runs via Mac LaunchAgent, pushes commits to GitHub, closes resolved issues, waits for CI, and sends a Telegram notification with the build result.

---

## Privacy

- All data is stored in **IndexedDB on your device only**
- **No analytics, no tracking, no cookies**
- **No server, no database, no accounts**
- **No data ever leaves your browser**
- Works completely offline after first visit
- Export your data anytime as a JSON file

---

## Medical Disclaimer

BabyBloom is an informational tool based on guidelines from the American Academy of Pediatrics (AAP), Centers for Disease Control and Prevention (CDC), and World Health Organization (WHO). It is **not a substitute for professional medical advice**. Always consult your pediatrician for medical decisions regarding your child's health.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Follow the code conventions in `src/` — TypeScript strict mode, `@/` path alias, feature modules under `src/features/`
4. Run `npm run type-check && npm run test` before submitting
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ for Saanvi<br/>
  <sub>Built by a new parent, for new parents.</sub>
</p>
