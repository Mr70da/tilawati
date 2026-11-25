import type { ExpoConfig } from "expo/config";

/**
 * Recitation runs fully on-device. The INTERNET permission is there only to download reciters' audio for
 * "Listen & repeat", tafsir and the update check (and, in dev builds, to reach the Metro bundler).
 */
const release = process.env.TILAWATI_RELEASE === "1";

const config: ExpoConfig = {
  name: "Tilawati",
  slug: "tilawati",
  version: "1.2.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "tilawati",
  userInterfaceStyle: "automatic",
  backgroundColor: "#0B1F1A",
  android: {
    package: "com.exab.tilawati",
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: "#0B3D2E",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: ["android.permission.RECORD_AUDIO"],
    blockedPermissions: ["android.permission.READ_PHONE_STATE", "android.permission.SYSTEM_ALERT_WINDOW"],
  },
  ios: {
    bundleIdentifier: "com.exab.tilawati",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "Tilawati listens to your recitation on this device to follow along and catch mistakes. Audio never leaves your phone.",
    },
  },
  plugins: [
    "./plugins/withReleaseSigning",
    "expo-router",
    "expo-sqlite",
    [
      "react-native-android-widget",
      {
        fonts: [
          "./node_modules/@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf",
          "./node_modules/@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf",
        ],
        widgets: [
          {
            name: "Wird",
            label: "Tilawati · Daily wird",
            description: "Today's wird progress; tap to continue reciting",
            minWidth: "250dp",
            minHeight: "110dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1800000,
            previewImage: "./assets/images/widget-preview.png",
          },
        ],
      },
    ],
    ["expo-notifications", { icon: "./assets/images/notification-icon.png", color: "#13704F" }],
    ["expo-localization", { supportsRTL: false }],
    "onnxruntime-react-native",
    [
      "@siteed/audio-studio",
      {
        enablePhoneStateHandling: false,
        enableNotifications: false,
        enableBackgroundAudio: false,
        enableDeviceDetection: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F7F3EA",
        image: "./assets/images/splash-icon.png",
        imageWidth: 128,
        dark: { backgroundColor: "#0A1A16", image: "./assets/images/splash-icon.png" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          // Ship arm64 + armv7 only: keeps the onnxruntime native libs out of x86 slices on real devices.
          buildArchs: release ? ["arm64-v8a", "armeabi-v7a"] : undefined,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
