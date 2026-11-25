import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AmiriQuran_400Regular, useFonts as useQuranFont } from "@expo-google-fonts/amiri-quran";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts as useUiFonts,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { database } from "@/db";
import { ensureWarm, getTilawa, isWarm } from "@/engine/service";
import { initI18n, useI18n } from "@/i18n";
import { startReminders } from "@/notify/reminder";
import { startWidgetSync } from "@/widget/update";
import { loadQuran } from "@/quran";
import { getSettings } from "@/state/settings";
import { fonts, useTheme } from "@/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

database();
initI18n();

/** Time of the latest touch anywhere in the app, so the heavy warm-up waits until the user is idle. */
let lastTouch = Date.now();

export default function RootLayout() {
  const [quranFont] = useQuranFont({ AmiriQuran_400Regular });
  const [uiFonts] = useUiFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [quranReady, setQuranReady] = useState(false);
  const [warming, setWarming] = useState(false);
  const { c, dark } = useTheme();

  useEffect(() => {
    loadQuran()
      .then(() => setQuranReady(true))
      .catch(() => setQuranReady(true));
  }, []);

  const ready = quranFont && uiFonts && quranReady;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    startReminders();
    startWidgetSync();
    // Load the model in the background (native, doesn't block the UI), then build the engine's indexes once the
    // user has been idle for a moment: that step blocks JS for a few seconds and would swallow taps.
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const id = setTimeout(() => {
      getTilawa(getSettings().tier)
        .then((tilawa) => {
          if (cancelled || isWarm(tilawa)) return;
          timer = setInterval(() => {
            if (Date.now() - lastTouch < 2000 || AppState.currentState !== "active") return;
            if (timer) clearInterval(timer);
            timer = null;
            // Show the "preparing" pill first: its native spinner keeps turning while the JS thread is busy.
            setWarming(true);
            setTimeout(() => {
              ensureWarm(tilawa);
              setWarming(false);
            }, 120);
          }, 500);
        })
        .catch(() => {});
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(id);
      if (timer) clearInterval(timer);
    };
  }, [ready]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }} onTouchStart={() => (lastTouch = Date.now())}>
      <SafeAreaProvider>
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "slide_from_right" }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recite" options={{ animation: "fade_from_bottom", gestureEnabled: false }} />
          <Stack.Screen name="hifz" />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="jump" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="credits" />
          <Stack.Screen name="tafsir" />
          <Stack.Screen name="wird" options={{ animation: "none" }} />
          <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
        </Stack>
        {warming && <WarmingPill />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Shown for the few seconds the engine builds its indexes; everything in it animates natively. */
function WarmingPill() {
  const { c } = useTheme();
  const { t, dir } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8, left: 0, right: 0, alignItems: "center", direction: dir }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          elevation: 6,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <ActivityIndicator size="small" color={c.primary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.text }}>{t("recite.preparing")}</Text>
      </View>
    </View>
  );
}
