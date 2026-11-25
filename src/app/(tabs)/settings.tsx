import type { ReactNode } from "react";
import { Alert, Linking, ScrollView, Switch, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { deleteDownloads, downloadedBytes, RECITERS } from "@/audio/ayahAudio";
import { engineStatus, getTilawa, subscribeEngine } from "@/engine/service";
import type { EngineStatus } from "@/engine/service";
import { setLanguage, useI18n } from "@/i18n";
import { requestReminderPermission, syncReminders } from "@/notify/reminder";
import { BASMALA } from "@/quran";
import { deleteTafsir, TAFSIRS, tafsirBytes } from "@/quran/tafsir";
import { pickAndRestore, shareBackup } from "@/state/backup";
import { GOAL_AMOUNTS } from "@/state/goal";
import { checkForUpdate } from "@/update/check";
import type { Update } from "@/update/check";
import type { GoalUnit } from "@/state/goal";
import { updateSettings, useSettings } from "@/state/settings";
import type { Settings as AppSettings } from "@/state/settings";
import { Button, Card, Row, Screen, Segmented, T, Tap } from "@/ui/kit";
import type { IconName } from "@/ui/kit";
import { fonts, radius, space, useTheme } from "@/ui/theme";

const DEVELOPER = { name: "Mahmoud Shaban", linkedin: "https://www.linkedin.com/in/mhmoudmoh/" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space(1) }}>
      <T v="label" muted style={{ paddingHorizontal: space(1) }}>
        {title}
      </T>
      <Card style={{ gap: space(2) }}>{children}</Card>
    </View>
  );
}

function Item({ icon, label, children, below }: { icon: IconName; label: string; children?: ReactNode; below?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(1) }}>
      <Row gap={space(1.5)}>
        <View
          style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={icon} size={18} color={c.primary} />
        </View>
        <T v="heading" style={{ flex: 1 }}>
          {label}
        </T>
        {children}
      </Row>
      {below}
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const { c } = useTheme();
  const { t, tc, num, flip, lang } = useI18n();
  const s = useSettings();
  const [engine, setEngine] = useState<EngineStatus>(engineStatus());
  useEffect(() => subscribeEngine(setEngine), []);
  const [audioBytes, setAudioBytes] = useState(() => {
    try {
      return downloadedBytes();
    } catch {
      return 0;
    }
  });
  const [tafsirSize, setTafsirSize] = useState(() => {
    try {
      return tafsirBytes();
    } catch {
      return 0;
    }
  });
  const [notifDenied, setNotifDenied] = useState(false);
  const setReminder = (patch: Partial<AppSettings>) => {
    updateSettings(patch);
    syncReminders();
  };
  const onReminder = async (on: boolean) => {
    if (!on) return setReminder({ reminder: false });
    const ok = await requestReminderPermission().catch(() => false);
    setNotifDenied(!ok);
    if (ok) setReminder({ reminder: true });
  };
  const stepTime = (delta: number) => {
    const total = (((s.reminderHour * 60 + s.reminderMinute + delta) % 1440) + 1440) % 1440;
    setReminder({ reminderHour: Math.floor(total / 60), reminderMinute: total % 60 });
  };
  const h12 = s.reminderHour % 12 || 12;
  const timeLabel =
    `${num(h12)}:${num(String(s.reminderMinute).padStart(2, "0"))} ` +
    (lang === "ar" ? (s.reminderHour < 12 ? "ص" : "م") : s.reminderHour < 12 ? "AM" : "PM");
  const [updateState, setUpdateState] = useState<null | "checking" | "none" | "offline" | Update>(null);
  const onCheckUpdate = async () => {
    setUpdateState("checking");
    try {
      setUpdateState((await checkForUpdate(true)) ?? "none");
    } catch {
      setUpdateState("offline");
    }
  };
  const onBackup = () => shareBackup(t("settings.backup")).catch(() => Alert.alert(t("settings.backupFailed")));
  const onRestore = () =>
    Alert.alert(t("settings.restoreTitle"), t("settings.restoreWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.restore"),
        style: "destructive",
        onPress: async () => {
          const r = await pickAndRestore().catch(() => ({ ok: false as const, reason: "invalid" as const }));
          if (r.ok) Alert.alert(t("settings.restoreDone"), tc("settings.restoredSessions", r.sessions));
          else if (r.reason === "invalid") Alert.alert(t("settings.restoreInvalid"));
        },
      },
    ]);
  const mb = (b: number) => `${num(Math.round(b / 1e5) / 10)} MB`;

  const engineLine =
    engine.kind === "ready"
      ? `${engine.tier === "full" ? "spliced-clean" : "spliced-clean-lite"} · ${engine.backend} · ${num(engine.loadMs)} ms`
      : engine.kind === "loading"
        ? "…"
        : engine.kind === "error"
          ? engine.message
          : "—";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2.5), paddingBottom: space(5) }}>
        <T v="display">{t("settings.title")}</T>

        <Section title={t("settings.appearance")}>
          <Item
            icon="language"
            label={t("settings.language")}
            below={
              <Segmented
                value={s.language}
                onChange={(v) => {
                  updateSettings({ language: v, languageChosen: true });
                  setLanguage(v);
                }}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
              />
            }
          />
          <Item
            icon="contrast"
            label={t("settings.theme")}
            below={
              <Segmented
                value={s.theme}
                onChange={(v) => updateSettings({ theme: v })}
                options={[
                  { value: "system", label: t("settings.system") },
                  { value: "light", label: t("settings.light") },
                  { value: "dark", label: t("settings.dark") },
                ]}
              />
            }
          />
          <Item
            icon="text"
            label={t("settings.fontSize")}
            below={
              <View style={{ gap: space(1) }}>
                <Text
                  style={{
                    fontFamily: fonts.quran,
                    fontSize: s.fontSize,
                    lineHeight: s.fontSize * 2,
                    color: c.text,
                    textAlign: "center",
                    writingDirection: "rtl",
                  }}
                >
                  {BASMALA}
                </Text>
                <Row style={{ justifyContent: "center" }} gap={space(2)}>
                  {[20, 24, 28, 32, 36].map((size) => (
                    <Tap
                      key={size}
                      onPress={() => updateSettings({ fontSize: size })}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: s.fontSize === size ? c.primary : c.surfaceAlt,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10 + (size - 20) / 2, color: s.fontSize === size ? c.onPrimary : c.text }}>
                        ع
                      </Text>
                    </Tap>
                  ))}
                </Row>
              </View>
            }
          />
        </Section>

        <Section title={t("settings.goal")}>
          <Item
            icon="flag-outline"
            label={t("settings.goalUnit")}
            below={
              <Segmented
                value={s.goal ? s.goal.unit : "off"}
                onChange={(v) => {
                  if (v === "off") return setReminder({ goal: null });
                  const unit = v as GoalUnit;
                  const amount = s.goal && GOAL_AMOUNTS[unit].includes(s.goal.amount) ? s.goal.amount : GOAL_AMOUNTS[unit][0];
                  setReminder({ goal: { unit, amount } });
                }}
                options={[
                  { value: "off", label: t("settings.goalOff") },
                  { value: "pages", label: t("goal.pages") },
                  { value: "ayahs", label: t("goal.ayahs") },
                  { value: "minutes", label: t("goal.minutes") },
                ]}
              />
            }
          />
          {s.goal && (
            <Item
              icon="calendar-outline"
              label={t("settings.goalAmount")}
              below={
                <Segmented
                  value={String(s.goal.amount)}
                  onChange={(v) => setReminder({ goal: { unit: s.goal!.unit, amount: Number(v) } })}
                  options={GOAL_AMOUNTS[s.goal.unit].map((n) => ({ value: String(n), label: num(n) }))}
                />
              }
            />
          )}
          {s.goal && (
            <Item
              icon="notifications-outline"
              label={t("settings.reminder")}
              below={
                notifDenied ? (
                  <Row gap={space(1)}>
                    <T v="caption" color={c.danger} style={{ flex: 1 }}>
                      {t("settings.reminderDenied")}
                    </T>
                    <Tap onPress={() => Linking.openSettings()} hitSlop={8}>
                      <T v="label" color={c.primary}>
                        {t("settings.openSystemSettings")}
                      </T>
                    </Tap>
                  </Row>
                ) : undefined
              }
            >
              <Switch value={s.reminder} onValueChange={onReminder} trackColor={{ true: c.primary, false: c.surfaceAlt }} thumbColor="#fff" />
            </Item>
          )}
          {s.goal && s.reminder && (
            <Item icon="time-outline" label={t("settings.reminderTime")}>
              <Row gap={space(1)}>
                <Tap onPress={() => stepTime(-30)} hitSlop={6} accessibilityLabel="-30" style={{ padding: 4 }}>
                  <Ionicons name="remove-circle-outline" size={24} color={c.primary} />
                </Tap>
                <T v="heading" style={{ minWidth: 76 }} center>
                  {timeLabel}
                </T>
                <Tap onPress={() => stepTime(30)} hitSlop={6} accessibilityLabel="+30" style={{ padding: 4 }}>
                  <Ionicons name="add-circle-outline" size={24} color={c.primary} />
                </Tap>
              </Row>
            </Item>
          )}
        </Section>

        <Section title={t("settings.recitation")}>
          <Item
            icon="hardware-chip-outline"
            label={t("settings.model")}
            below={
              <Segmented
                value={s.tier}
                onChange={(v) => {
                  updateSettings({ tier: v });
                  getTilawa(v).catch(() => {});
                }}
                options={[
                  { value: "auto", label: t("settings.modelAuto") },
                  { value: "lite", label: t("settings.modelLite") },
                  { value: "full", label: t("settings.modelFull") },
                ]}
              />
            }
          />
          <Item
            icon="checkmark-done"
            label={t("settings.confirm")}
            below={
              <Segmented
                value={s.confirm}
                onChange={(v) => updateSettings({ confirm: v })}
                options={[
                  { value: "delay", label: t("settings.confirmDelay") },
                  { value: "next-word", label: t("settings.confirmNext") },
                ]}
              />
            }
          />
          <Item icon="refresh-circle-outline" label={t("settings.selfCorrections")}>
            <Switch
              value={s.countSelfCorrections}
              onValueChange={(v) => updateSettings({ countSelfCorrections: v })}
              trackColor={{ true: c.primary, false: c.surfaceAlt }}
              thumbColor="#fff"
            />
          </Item>
          <Item icon="phone-portrait-outline" label={t("settings.haptics")}>
            <Switch
              value={s.haptics}
              onValueChange={(v) => updateSettings({ haptics: v })}
              trackColor={{ true: c.primary, false: c.surfaceAlt }}
              thumbColor="#fff"
            />
          </Item>
        </Section>

        <Section title={t("settings.listening")}>
          <Item
            icon="headset"
            label={t("settings.reciter")}
            below={
              <View style={{ gap: 6 }}>
                {RECITERS.map((r) => {
                  const on = s.reciter === r.id;
                  return (
                    <Tap
                      key={r.id}
                      onPress={() => updateSettings({ reciter: r.id })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space(1),
                        padding: space(1.25),
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: on ? c.primary : c.border,
                        backgroundColor: on ? c.primarySoft : "transparent",
                      }}
                    >
                      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? c.primary : c.textMuted} />
                      <T v="heading" color={on ? c.primary : c.text} style={{ flex: 1 }}>
                        {lang === "ar" ? r.ar : r.en}
                      </T>
                    </Tap>
                  );
                })}
              </View>
            }
          />
          <Item
            icon="repeat"
            label={t("settings.learnRepeat")}
            below={
              <Segmented
                value={String(s.learnRepeat)}
                onChange={(v) => updateSettings({ learnRepeat: Number(v) as 1 | 2 | 3 })}
                options={[1, 2, 3].map((n) => ({ value: String(n), label: tc("settings.times", n) }))}
              />
            }
          />
          <Item icon="cloud-download-outline" label={t("settings.audioStorage")}>
            <T v="caption" muted>
              {mb(audioBytes)}
            </T>
            {audioBytes > 0 && (
              <Tap
                onPress={() => {
                  deleteDownloads();
                  setAudioBytes(0);
                }}
                hitSlop={8}
              >
                <T v="label" color={c.danger}>
                  {t("settings.deleteAudio")}
                </T>
              </Tap>
            )}
          </Item>
        </Section>

        <Section title={t("settings.tafsir")}>
          <View style={{ gap: 6 }}>
            {TAFSIRS.map((x) => {
              const on = s.tafsir === x.id;
              return (
                <Tap
                  key={x.id}
                  onPress={() => updateSettings({ tafsir: x.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space(1),
                    padding: space(1.25),
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: on ? c.primary : c.border,
                    backgroundColor: on ? c.primarySoft : "transparent",
                  }}
                >
                  <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? c.primary : c.textMuted} />
                  <T v="heading" color={on ? c.primary : c.text} style={{ flex: 1 }}>
                    {lang === "ar" ? x.ar : x.en}
                  </T>
                </Tap>
              );
            })}
          </View>
          <Item icon="cloud-download-outline" label={t("settings.tafsirStorage")}>
            <T v="caption" muted>
              {mb(tafsirSize)}
            </T>
            {tafsirSize > 0 && (
              <Tap
                onPress={() => {
                  deleteTafsir();
                  setTafsirSize(0);
                }}
                hitSlop={8}
              >
                <T v="label" color={c.danger}>
                  {t("settings.deleteAudio")}
                </T>
              </Tap>
            )}
          </Item>
        </Section>

        <Section title={t("settings.data")}>
          <T v="caption" muted>
            {t("settings.dataHint")}
          </T>
          <Row gap={space(1)}>
            <Button title={t("settings.backup")} icon="cloud-upload-outline" kind="secondary" style={{ flex: 1, height: 48 }} onPress={onBackup} />
            <Button title={t("settings.restore")} icon="cloud-download-outline" kind="ghost" style={{ flex: 1, height: 48 }} onPress={onRestore} />
          </Row>
        </Section>

        <Section title={t("settings.about")}>
          <Row gap={space(1.5)} center={false}>
            <Ionicons name="shield-checkmark" size={20} color={c.primary} />
            <T style={{ flex: 1 }}>{t("settings.privacy")}</T>
          </Row>
          <Row gap={space(1.5)} center={false}>
            <Ionicons name="information-circle" size={20} color={c.gold} />
            <T muted style={{ flex: 1 }}>
              {t("settings.limits")}
            </T>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <T v="label" muted>
              {t("settings.engine")}
            </T>
            <T v="caption" muted style={{ flexShrink: 1 }} numberOfLines={2}>
              {engineLine}
            </T>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <T v="label" muted>
              {t("settings.version")}
            </T>
            <T v="caption" muted>
              {num(Constants.expoConfig?.version ?? "1.0.0")}
            </T>
          </Row>
          <Row style={{ justifyContent: "space-between" }} gap={space(1)}>
            <T v="caption" muted style={{ flex: 1 }}>
              {updateState === "checking"
                ? t("update.checking")
                : updateState === "none"
                  ? t("update.upToDate")
                  : updateState === "offline"
                    ? t("update.offline")
                    : updateState
                      ? t("update.available", { v: num(updateState.version) })
                      : ""}
            </T>
            {updateState && typeof updateState === "object" ? (
              <Tap onPress={() => Linking.openURL(updateState.url).catch(() => {})} hitSlop={8}>
                <T v="label" color={c.primary}>
                  {t("update.download")}
                </T>
              </Tap>
            ) : (
              <Tap onPress={onCheckUpdate} hitSlop={8} disabled={updateState === "checking"}>
                <T v="label" color={c.primary}>
                  {t("update.check")}
                </T>
              </Tap>
            )}
          </Row>
          <Tap onPress={() => Linking.openURL(DEVELOPER.linkedin).catch(() => {})} accessibilityLabel={t("settings.linkedin")}>
            <Row gap={space(1.5)} style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space(1.25) }}>
              <View
                style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: "#0A66C2", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="logo-linkedin" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="caption" muted>
                  {t("settings.developer")}
                </T>
                <T v="heading">{DEVELOPER.name}</T>
              </View>
              <T v="label" color={c.primary}>
                LinkedIn
              </T>
              <Ionicons name="open-outline" size={16} color={c.primary} />
            </Row>
          </Tap>
          <Tap onPress={() => router.push("/credits")}>
            <Row>
              <T v="heading" color={c.primary} style={{ flex: 1 }}>
                {t("settings.credits")}
              </T>
              <Ionicons name={flip("chevron-forward", "chevron-back")} size={18} color={c.primary} />
            </Row>
          </Tap>
        </Section>
      </ScrollView>
    </Screen>
  );
}
