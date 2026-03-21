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
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
</p>

---

## What is BabyBloom?

BabyBloom is a free, privacy-first Progressive Web App that helps new parents track their baby's care, growth, and development. All data stays on your device — nothing is ever sent to a server.

Built as a single HTML file with zero build steps, BabyBloom works on any device with a modern browser and can be installed as a native-feeling app on your home screen.

**Live Demo:** [akashkguw.github.io/babybloom](https://akashkguw.github.io/babybloom)

---

## Features

### Daily Tracking
- **Feeding** — Breast (L/R with real-time timer), bottle (oz), solids, and pump sessions
- **Diapers** — Wet, dirty, or both with color, consistency, and pee amount tracking
- **Sleep** — Nap, night sleep, and wake-up with automatic duration calculation
- **Growth** — Weight, height, and head circumference with WHO percentile charts
- **Temperature** — Log readings with fever threshold alerts
- **Bath** — Full bath, sponge bath, or hair wash
- **Medications** — Name, dose, and schedule tracking
- **Allergies** — Food introduction log with reaction tracking

### Quick Log (Home Page)
One-tap logging directly from the home screen — no navigating to forms for frequent actions like diaper changes, naps, and breast feeding. The inline feed timer starts counting in real time and logs the exact duration when you tap Done.

### Voice Logging
Hands full? Just tap the microphone button and speak. BabyBloom understands natural phrases like "bottle 4 ounces," "wet diaper," "nap," "woke up," "temperature 99.5," or "breast left 15 minutes." It parses your speech, shows a confirmation, and auto-saves — no typing required. You can even specify a time: "bottle 3 oz at 2:30 PM." Powered by the Web Speech API (works in Chrome, Safari, and Edge).

### Siri Shortcuts (iPhone)
Log without even opening the app. BabyBloom supports URL-based shortcuts that work with Apple's Shortcuts app:

- **One-tap shortcuts** — Add icons to your home screen for "Breast L," "Wet Diaper," "Nap," etc. One tap logs instantly.
- **"Hey Siri" voice** — Say "Hey Siri, Baby Breast L" to log hands-free while holding your baby.
- **Voice dictation shortcut** — Create a "Baby Log" shortcut with Dictate Text to say anything naturally: "bottle 4 ounces," "dirty diaper," "woke up."

Set up in seconds from **Settings → Siri Shortcuts** inside the app. Each shortcut opens BabyBloom momentarily, logs the action, shows confirmation, and you're done.

### Consolidated Stats
Interactive charts with metric selectors for each category. Toggle between count, duration (minutes/hours), and volume (oz) on a single chart. View daily, weekly, or monthly trends.

### Developmental Milestones
Track 100+ milestones across motor, cognitive, social, and language domains from newborn through 24 months. Each stage includes activity suggestions, tips, and red flags to discuss with your pediatrician.

### Comprehensive Guide
- **Vaccines** — Full CDC immunization schedule with progress tracking
- **Sleep Guide** — Age-appropriate sleep totals, patterns, and nap schedules
- **Feeding Guide** — Breastfeeding, formula, and solid food timelines
- **Solid Foods** — Vegetarian, non-vegetarian, and vegan meal plans by age
- **Milk Intake** — Breast and formula amounts by age
- **Growth Charts** — WHO weight and height percentile curves with your baby's data plotted
- **Activities** — Age-appropriate play ideas for every stage
- **Common Remedies** — Gas, reflux, low milk supply, and everyday questions
- **Mom Nutrition** — What to eat (and avoid) while breastfeeding, by stage
- **Parent Wellness** — Postpartum warning signs, self-care checklist, and crisis resources
- **Screen Time** — AAP guidelines by age
- **Medicine Calculator** — Weight-based Tylenol and Motrin dosing reference
- **Well-Child Visits** — Recommended check-up schedule

### Safety Center
- **Safety Tips** — Safe sleep, baby-proofing, car safety, choking prevention, water safety, sun protection
- **Infant CPR** — Step-by-step reference guide
- **Choking Response** — Back blows and chest thrusts for infants
- **Fever Guide** — When to worry by age, with action steps
- **Emergency Contacts** — Save pediatrician, poison control, and custom contacts with one-tap calling

### Additional Features
- **Feeding Reminders** — Configurable push notifications (2h, 2.5h, 3h, or 4h intervals)
- **Dark Mode** — Easy on the eyes during late-night feeds
- **Search** — Find anything across logs, milestones, vaccines, safety info, and guides
- **Multiple Profiles** — Track more than one child with separate data (logs, milestones, vaccines) per baby, inline rename, and one-tap switching
- **Pediatrician Report** — Generate a printable health summary for doctor visits
- **Export / Import** — JSON backup and restore for your data
- **Teeth Tracker** — Track all 20 baby teeth eruption dates
- **Baby Firsts** — Record and cherish milestones like first smile, first steps, first word

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (UMD via CDN) |
| Rendering | Pure `React.createElement` — no JSX, no build step |
| Storage | IndexedDB (persistent, local-only) |
| Offline | Service Worker with cache-first strategy |
| Styling | Inline styles with light/dark theme system |
| Hosting | GitHub Pages (static, single HTML file) |
| Icons | Hand-crafted SVG path data |
| Charts | Custom SVG bar charts and growth curve plots |
| Voice | Web Speech API with NLP parser for hands-free logging |
| Shortcuts | URL parameter API for Siri Shortcuts / Tasker / automation |

**Zero dependencies. Zero build tools. Zero server calls.**

---

## Getting Started

### Use it now

Visit **[akashkguw.github.io/babybloom](https://akashkguw.github.io/babybloom)** and tap "Add to Home Screen" to install.

### Run locally

```bash
git clone https://github.com/akashkguw/babybloom.git
cd babybloom
# Open index.html in any browser — that's it
open index.html
```

No `npm install`. No `webpack`. No `.env` files. Just one HTML file.

### Deploy your own

1. Fork this repository
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch → main → / (root)**
4. Your site will be live at `https://<username>.github.io/babybloom`

---

## Project Structure

```
babybloom/
├── index.html       # The entire app (~2100 lines)
├── sw.js            # Service worker for offline support
├── manifest.json    # PWA manifest for installability
├── LICENSE          # MIT License
└── README.md        # You are here
```

---

## Privacy

BabyBloom takes your family's privacy seriously.

- All data is stored in **IndexedDB on your device only**
- **No analytics, no tracking, no cookies**
- **No server, no database, no accounts**
- **No data ever leaves your browser**
- Works completely offline after first visit
- Export your data anytime as a JSON file

---

## Medical Disclaimer

BabyBloom is an informational tool based on guidelines from the American Academy of Pediatrics (AAP), Centers for Disease Control and Prevention (CDC), and World Health Organization (WHO). It is **not a substitute for professional medical advice**. Always consult your pediatrician for medical decisions regarding your child's health.

Medicine dosage calculations are for reference only — always confirm with your doctor.

---

## Contributing

Contributions are welcome! Since this is a single-file architecture, please keep changes focused and test thoroughly.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ for Saanvi<br/>
  <sub>Built by a new parent, for new parents.</sub>
</p>
