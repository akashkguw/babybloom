#!/bin/bash
# ═══════════════════════════════════════════════════════════
# BabyBloom — Generate App Icons & Splash Screens
# Requires: ImageMagick (brew install imagemagick)
# Usage: ./scripts/generate-icons.sh [source-icon.png]
# Source icon should be 1024x1024 PNG with no transparency
# ═══════════════════════════════════════════════════════════

set -e

SOURCE="${1:-public/logo-512.png}"

if [ ! -f "$SOURCE" ]; then
  echo "❌ Source icon not found: $SOURCE"
  echo "   Usage: ./scripts/generate-icons.sh <1024x1024-icon.png>"
  exit 1
fi

echo "🍼 Generating BabyBloom app icons from $SOURCE..."

# ─── iOS Icons ───────────────────────────────────────────
IOS_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [ -d "ios/App/App/Assets.xcassets" ]; then
  mkdir -p "$IOS_DIR"
  # iOS requires a single 1024x1024 icon (Xcode generates all sizes from it)
  convert "$SOURCE" -resize 1024x1024 "$IOS_DIR/AppIcon-1024.png"
  # Also create common sizes for backwards compatibility
  for size in 20 29 40 58 60 76 80 87 120 152 167 180; do
    convert "$SOURCE" -resize "${size}x${size}" "$IOS_DIR/AppIcon-${size}.png"
  done
  echo "✅ iOS icons generated in $IOS_DIR"
else
  echo "⚠️  iOS project not found — run 'npx cap add ios' first"
fi

# ─── Android Icons ───────────────────────────────────────
ANDROID_RES="android/app/src/main/res"
if [ -d "$ANDROID_RES" ]; then
  # Standard icons
  for dir_size in "mipmap-mdpi 48" "mipmap-hdpi 72" "mipmap-xhdpi 96" "mipmap-xxhdpi 144" "mipmap-xxxhdpi 192"; do
    dir=$(echo "$dir_size" | cut -d' ' -f1)
    size=$(echo "$dir_size" | cut -d' ' -f2)
    mkdir -p "$ANDROID_RES/$dir"
    convert "$SOURCE" -resize "${size}x${size}" "$ANDROID_RES/$dir/ic_launcher.png"
    # Round icon variant
    convert "$SOURCE" -resize "${size}x${size}" \
      \( +clone -alpha extract -draw "fill black polygon 0,0 0,${size} ${size},0 fill white circle $((size/2)),$((size/2)) $((size/2)),0" -alpha off \) \
      -compose CopyOpacity -composite "$ANDROID_RES/$dir/ic_launcher_round.png"
  done

  # Notification icon (white silhouette on transparent background)
  for dir_size in "drawable-mdpi 24" "drawable-hdpi 36" "drawable-xhdpi 48" "drawable-xxhdpi 72" "drawable-xxxhdpi 96"; do
    dir=$(echo "$dir_size" | cut -d' ' -f1)
    size=$(echo "$dir_size" | cut -d' ' -f2)
    mkdir -p "$ANDROID_RES/$dir"
    convert "$SOURCE" -resize "${size}x${size}" -colorspace Gray -threshold 50% -negate "$ANDROID_RES/$dir/ic_stat_babybloom.png"
  done

  echo "✅ Android icons generated in $ANDROID_RES"
else
  echo "⚠️  Android project not found — run 'npx cap add android' first"
fi

# ─── Splash Screen ───────────────────────────────────────
# Capacitor 6 uses a simple centered icon on solid color for splash
if [ -d "ios/App/App/Assets.xcassets" ]; then
  SPLASH_DIR="ios/App/App/Assets.xcassets/Splash.imageset"
  mkdir -p "$SPLASH_DIR"
  convert "$SOURCE" -resize 512x512 "$SPLASH_DIR/splash.png"
  convert "$SOURCE" -resize 1024x1024 "$SPLASH_DIR/splash@2x.png"
  convert "$SOURCE" -resize 1536x1536 "$SPLASH_DIR/splash@3x.png"
  cat > "$SPLASH_DIR/Contents.json" << 'JSON'
{
  "images": [
    { "filename": "splash.png", "idiom": "universal", "scale": "1x" },
    { "filename": "splash@2x.png", "idiom": "universal", "scale": "2x" },
    { "filename": "splash@3x.png", "idiom": "universal", "scale": "3x" }
  ],
  "info": { "author": "xcode", "version": 1 }
}
JSON
  echo "✅ iOS splash screen generated"
fi

if [ -d "$ANDROID_RES" ]; then
  mkdir -p "$ANDROID_RES/drawable"
  convert "$SOURCE" -resize 288x288 "$ANDROID_RES/drawable/splash.png"
  echo "✅ Android splash screen generated"
fi

echo ""
echo "🎉 Done! Icon generation complete."
echo "   Next: run 'npm run build:mobile && npx cap sync' to update native projects."
