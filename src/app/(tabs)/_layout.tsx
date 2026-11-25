import { View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { T, Tap } from "@/ui/kit";
import type { IconName } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["home-outline", "home"],
  mushaf: ["book-outline", "book"],
  history: ["stats-chart-outline", "stats-chart"],
  settings: ["settings-outline", "settings"],
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c, dark } = useTheme();
  const { t, dir } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ direction: dir, backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: c.surface,
          borderRadius: radius.xl,
          padding: 6,
          borderWidth: dark ? 1 : 0,
          borderColor: c.border,
          shadowColor: "#000",
          shadowOpacity: dark ? 0 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: dark ? 0 : 6,
        }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const [off, on] = ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
          return (
            <Tap
              key={route.key}
              accessibilityLabel={t(`tabs.${route.name === "index" ? "home" : route.name}`)}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                borderRadius: radius.lg,
                backgroundColor: focused ? c.primarySoft : "transparent",
              }}
              scaleTo={0.92}
            >
              <Ionicons name={focused ? on : off} size={22} color={focused ? c.primary : c.textMuted} />
              <T v="caption" center color={focused ? c.primary : c.textMuted} style={{ marginTop: 2 }}>
                {t(`tabs.${route.name === "index" ? "home" : route.name}`)}
              </T>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: "shift" }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="mushaf" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
