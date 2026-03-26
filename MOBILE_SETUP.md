# BabyBloom — Mobile App Setup & Publishing Guide

This guide walks you through building BabyBloom as native iOS and Android apps using Capacitor.

---

## Prerequisites

**For iOS (App Store):**
- macOS with Xcode 15+ installed
- Apple Developer account ($99/year) — https://developer.apple.com
- CocoaPods (`sudo gem install cocoapods`)

**For Android (Play Store):**
- Android Studio (any OS) — https://developer.android.com/studio
- Google Play Developer account ($25 one-time) — https://play.google.com/console
- JDK 17+ (bundled with Android Studio)

**For both:**
- Node.js 18+ and npm

---

## Step 1: Install Dependencies

```bash
cd babybloom
npm install
```

This installs Capacitor core, CLI, and all native plugins (status bar, haptics, notifications, etc.).

---

## Step 2: Add Native Platforms

```bash
# Add iOS project
npx cap add ios

# Add Android project
npx cap add android
```

This creates the `ios/` and `android/` directories with native project files.

---

## Step 3: Build & Sync

```bash
# Build the web app for mobile (uses base '/' instead of '/babybloom/')
npm run build:mobile

# Copy the built web app into the native projects
npx cap sync
```

---

## Step 4: App Icons

You need a **1024x1024 PNG** icon with no transparency (App Store requires this).

**Option A — Use the included script (requires ImageMagick):**
```bash
brew install imagemagick  # macOS
./scripts/generate-icons.sh path/to/your-1024x1024-icon.png
```

**Option B — Use an online tool:**
1. Go to https://icon.kitchen or https://appicon.co
2. Upload your 1024x1024 icon
3. Download the generated icons
4. Place iOS icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
5. Place Android icons in `android/app/src/main/res/mipmap-*/`

---

## Step 5: Configure App Identity

### Bundle ID / Package Name
The default is `com.babybloom.app`. To change it:

**In `capacitor.config.ts`:**
```ts
appId: 'com.yourcompany.babybloom',
```

**Then re-sync:**
```bash
npx cap sync
```

> **Important:** The bundle ID must be unique on both App Store and Play Store. Once published, it cannot be changed.

### App Display Name
Change `appName` in `capacitor.config.ts`:
```ts
appName: 'BabyBloom',
```

---

## Step 6: Test Locally

### iOS Simulator
```bash
npm run mobile:ios
# This builds, syncs, and opens Xcode
# In Xcode: select a simulator → press ▶ Run
```

### Android Emulator
```bash
npm run mobile:android
# This builds, syncs, and opens Android Studio
# In Android Studio: select a device → press ▶ Run
```

### Test on Physical Device
- **iOS:** Connect your iPhone, select it in Xcode, and run. You'll need to trust the developer certificate in Settings → General → Device Management.
- **Android:** Enable Developer Mode on your phone, connect via USB, and run from Android Studio.

---

## Publishing to App Store (iOS)

### 1. Create App Store Connect listing
1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** → **+** → **New App**
3. Fill in: Name (`BabyBloom`), Primary Language, Bundle ID, SKU

### 2. Signing & Capabilities in Xcode
1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target → **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Select your Apple Developer team
5. The bundle ID should match `capacitor.config.ts`

### 3. Privacy & Permissions
BabyBloom uses these capabilities (add in Xcode → Signing & Capabilities if needed):
- **Push Notifications** (for feed reminders)
- **Speech Recognition** (for voice logging)
- **Microphone** (for voice logging)

Add these to `ios/App/App/Info.plist`:
```xml
<key>NSSpeechRecognitionUsageDescription</key>
<string>BabyBloom uses speech recognition to log feeding, diapers, and sleep by voice.</string>
<key>NSMicrophoneUsageDescription</key>
<string>BabyBloom needs microphone access for voice logging.</string>
```

### 4. Build & Upload
1. In Xcode: **Product** → **Archive**
2. In the Organizer window: **Distribute App** → **App Store Connect**
3. Follow the prompts to upload

### 5. App Store Review
- Fill in app description, keywords, screenshots, and privacy policy URL
- Submit for review (typically 24-48 hours)

### App Store Required Metadata
- **Privacy Policy URL** — Required. Host at your website.
- **Screenshots** — At least one set for 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 11 Pro Max)
- **App Category** — Health & Fitness or Medical
- **Age Rating** — 4+
- **Description** — Use the README description

---

## Publishing to Google Play Store (Android)

### 1. Create Play Console listing
1. Go to https://play.google.com/console
2. **Create app** → fill in name, language, app type (App), free/paid

### 2. Signing
Generate a signed release APK/AAB:

```bash
cd android

# Generate a keystore (do this ONCE, then keep the file safe!)
keytool -genkey -v -keystore babybloom-release.keystore \
  -alias babybloom -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/app/build.gradle` (inside `android {}` block):
```groovy
signingConfigs {
    release {
        storeFile file('../babybloom-release.keystore')
        storePassword 'YOUR_STORE_PASSWORD'
        keyAlias 'babybloom'
        keyPassword 'YOUR_KEY_PASSWORD'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 3. Build Release AAB
```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### 4. Upload to Play Console
1. Go to **Production** → **Create new release**
2. Upload the `.aab` file
3. Add release notes

### 5. Store Listing
- **Short description** (80 chars): "Evidence-based baby care companion for 0-24 months"
- **Full description**: Use the README
- **Screenshots**: At least 2 phone screenshots
- **Feature graphic**: 1024x500 PNG
- **App category**: Parenting
- **Content rating**: Complete the questionnaire
- **Privacy policy URL**: Required

### Android Permissions
BabyBloom uses these (automatically declared by Capacitor plugins):
- `INTERNET` — for loading web fonts
- `VIBRATE` — for haptic feedback
- `RECEIVE_BOOT_COMPLETED` — for notification scheduling
- `RECORD_AUDIO` — for voice logging (if using Web Speech API)

---

## Ongoing Development Workflow

After making changes to the React code:

```bash
# Quick sync to test on device
npm run build:mobile && npx cap sync

# Or use the all-in-one commands
npm run mobile:ios      # Build + sync + open Xcode
npm run mobile:android  # Build + sync + open Android Studio
```

The web PWA continues to work independently:
```bash
npm run build  # Builds with /babybloom/ base for GitHub Pages
```

---

## Troubleshooting

**"Module not found" errors after `cap add`:**
```bash
npx cap sync
```

**iOS build fails with CocoaPods error:**
```bash
cd ios/App && pod install && cd ../..
```

**Android build fails with Gradle error:**
```bash
cd android && ./gradlew clean && cd ..
npx cap sync android
```

**White screen on device:**
Make sure you used `npm run build:mobile` (not `npm run build`) — the base path must be `/` for native.

---

## Architecture Overview

```
babybloom/
├── capacitor.config.ts    ← Native app config (bundle ID, plugins)
├── vite.config.ts         ← Dual build: web (base /babybloom/) + mobile (base /)
├── src/
│   ├── lib/native.ts      ← Capacitor bridge (haptics, notifications, status bar)
│   ├── index.tsx           ← Entry point — initializes native platform
│   └── App.tsx             ← Main app — uses native APIs for dark mode, notifications
├── ios/                    ← Xcode project (generated by cap add ios)
├── android/                ← Android Studio project (generated by cap add android)
└── scripts/
    └── generate-icons.sh   ← App icon generator
```
