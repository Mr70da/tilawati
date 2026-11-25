/** First-launch tour: what the app does, one idea per page, with the language choice up front. */
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { setLanguage, useI18n } from "@/i18n";
import { updateSettings, useSettings } from "@/state/settings";
import { Button, Row, Screen, Segmented, T, Tap } from "@/ui/kit";
import type { IconName } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const PAGES: { icon: IconName; key: string }[] = [
  { icon: "mic", key: "follow" },
  { icon: "school", key: "hifz" },
  { icon: "headset", key: "listen" },
  { icon: "flag", key: "wird" },
  { icon: "book", key: "mushaf" },
];

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const { t } = useI18n();
  const { language } = useSettings();
  const [i, setI] = useState(0);
  const last = i === PAGES.length - 1;
  const page = PAGES[i];

  const finish = () => {
    updateSettings({ onboarded: true });
    router.replace("/");
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Row style={{ justifyContent: "space-between", paddingHorizontal: space(2), paddingVertical: space(1.5) }}>
        <View style={{ width: 150 }}>
          {i === 0 && (
            <Segmented
              value={language}
              onChange={(v) => {
                updateSettings({ language: v, languageChosen: true });
                setLanguage(v);
              }}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          )}
        </View>
        {!last && (
          <Tap onPress={finish} hitSlop={10}>
            <T v="label" muted>
              {t("welcome.skip")}
            </T>
          </Tap>
        )}
      </Row>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: space(3) }}>
        <Animated.View key={page.key} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} style={{ alignItems: "center", gap: space(2) }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: i % 2 ? c.goldSoft : c.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: space(1),
            }}
          >
            <Ionicons name={page.icon} size={52} color={i % 2 ? c.gold : c.primary} />
          </View>
          <T v="display" center>
            {t(`welcome.${page.key}Title`)}
          </T>
          <T muted center style={{ fontSize: 16, lineHeight: 26 }}>
            {t(`welcome.${page.key}Body`)}
          </T>
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: space(2), paddingBottom: space(2), gap: space(2) }}>
        <Row gap={6} style={{ justifyContent: "center" }}>
          {PAGES.map((p, k) => (
            <Tap key={p.key} onPress={() => setI(k)} hitSlop={6} accessibilityLabel={`${k + 1}`}>
              <View style={{ width: k === i ? 22 : 8, height: 8, borderRadius: radius.pill, backgroundColor: k === i ? c.primary : c.border }} />
            </Tap>
          ))}
        </Row>
        <Row gap={space(1)}>
          {i > 0 && <Button title={t("welcome.back")} kind="ghost" style={{ flex: 1 }} onPress={() => setI(i - 1)} />}
          <Button title={last ? t("welcome.start") : t("welcome.next")} style={{ flex: 2 }} onPress={() => (last ? finish() : setI(i + 1))} />
        </Row>
      </View>
    </Screen>
  );
}
