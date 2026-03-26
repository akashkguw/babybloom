import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.babybloom.app',
  appName: 'BabyBloom',
  webDir: 'dist',
  server: {
    // Allow inline scripts and styles used by the app
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFF8F0',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFF8F0',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_babybloom',
      iconColor: '#FF6B8A',
    },
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'BabyBloom',
    backgroundColor: '#1A1A2E',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1A1A2E',
  },
};

export default config;
