/**
 * The recitation screen. Free mode follows the reciter anywhere in the Quran; hifz and guided modes declare a
 * passage. Words fill in as they are recited, and mistakes light up amber (suspected) then red (confirmed).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getSession } from "@/db";
import { advanceWird } from "@/state/wird";
import { File, Paths } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOutDown, LinearTransition } from "react-native-reanimated";
import type { WordRef } from "@tilawa/core";
import { playAyah, prefetch, stopAyah } from "@/audio/ayahAudio";
import type { SessionMode } from "@/db";
import { useI18n } from "@/i18n";
import { ayahRange, ayahWords, surah, wordAt } from "@/quran";
import type { AyahId } from "@/quran";
import { wordStatus } from "@/engine/recitation";
import type { Mistake, RecitationState } from "@/engine/recitation";
import { useRecitation } from "@/engine/useRecitation";
import { useSettings } from "@/state/settings";
import { MicOrb } from "@/ui/MicOrb";
import { AyahBlock, Basmala, SurahHeader } from "@/ui/quran";
import type { HideMode } from "@/ui/quran";
import { Button, Chip, Header, IconButton, Row, Screen, T, Tap } from "@/ui/kit";
import { fonts, radius, space, useTheme } from "@/ui/theme";

type Params = { mode?: string; s?: string; from?: string; to?: string; hide?: string; sim?: string; learn?: string; wird?: string };

function statusesFor(st: RecitationState, s: number, a: number, hinted: Set<string>) {
  const n = ayahWords(s, a).length;
  const out: string[] = new Array(n);
  for (let w = 1; w <= n; w++) {
    const ws = wordStatus(st, s, a, w);
    out[w - 1] = ws === "pending" && hinted.has(`${s}:${a}:${w}`) ? "hint" : ws;
  }
  return out.join(",");
}

/** Listen & repeat: the reciter has finished this ayah (its last word, or anything after it, was reached). */
function ayahFinished(st: RecitationState, s: number, a: number): boolean {
  const last = ayahWords(s, a).length;
  if (st.recited.has(`${s}:${a}:${last}`) || st.byWord.has(`${s}:${a}:${last}`)) return true;
  const beyond = (w: WordRef | null) => !!w && w.surah === s && w.ayah > a;
  return beyond(st.current) || beyond(st.expected);
}

type Turn = "idle" | "loading" | "playing" | "yours" | "done";

/** The first word of the passage after the reciter's position that is still hidden. */
function nextHiddenWord(st: RecitationState, p: { surah: number; fromAyah: number; toAyah: number }, hinted: Set<string>): WordRef | null {
  let { ayah: a, word: w } = st.current && st.current.surah === p.surah ? st.current : (st.expected ?? { surah: p.surah, ayah: p.fromAyah, word: 1 });
  if (a < p.fromAyah) {
    a = p.fromAyah;
    w = 1;
  }
  for (; a <= p.toAyah; a++, w = 1) {
    const n = ayahWords(p.surah, a).length;
    for (; w <= n; w++) {
      if (wordStatus(st, p.surah, a, w) === "pending" && !hinted.has(`${p.surah}:${a}:${w}`)) return { surah: p.surah, ayah: a, word: w };
    }
  }
  return null;
}

/**
 * The ayahs a session got through, for moving the wird on: every ayah touched, except that the furthest one counts
 * only if its last word was reached (stopping mid-ayah leaves the wird on that ayah).
 */
function finishedAyahs(ayahs: string[], recited: string[], hints: string[]): string[] {
  const reached = new Set([...recited, ...hints]);
  const key = (id: string) => id.split(":").map(Number) as [number, number];
  const furthest = ayahs.reduce<string | null>((best, id) => {
    if (!best) return id;
    const [s, a] = key(id);
    const [bs, ba] = key(best);
    return s > bs || (s === bs && a > ba) ? id : best;
  }, null);
  return ayahs.filter((id) => {
    if (id !== furthest) return true;
    const [s, a] = key(id);
    return reached.has(`${s}:${a}:${ayahWords(s, a).length}`);
  });
}

export default function Recite() {
  "use no memo";
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const { c } = useTheme();
  const { t, tc, num, lang } = useI18n();
  const settings = useSettings();

  const mode = (params.mode === "hifz" || params.mode === "passage" ? params.mode : "free") as SessionMode;
  const passage = useMemo(() => {
    if (mode === "free" || !params.s) return undefined;
    const s = Number(params.s);
    const from = Number(params.from ?? 1);
    const to = Number(params.to ?? surah(s).ayahs);
    return { surah: s, fromAyah: from, toAyah: to };
  }, [mode, params.s, params.from, params.to]);
  const hide: HideMode = mode === "hifz" && params.hide !== "0" ? settings.hifzHide : "none";

  // Dev only: `?sim=1` replays documents/selftest.wav (pushed with adb) instead of the microphone.
  const simulateUri = __DEV__ && params.sim === "1" ? new File(Paths.document, "selftest.wav").uri : undefined;
  const rec = useRecitation({ mode, passage, simulateUri });
  const { state, phase } = rec;
  const listening = phase === "listening";

  // ---------- Listen & repeat: play an ayah, open the mic for the reciter to repeat it, then move on. ----------
  const learn = params.learn === "1" && !!passage;
  const [turn, setTurn] = useState<Turn>("idle");
  const [learnAyah, setLearnAyah] = useState(passage?.fromAyah ?? 1);
  const [audioError, setAudioError] = useState(false);
  const playback = useRef<{ aborted: boolean } | null>(null);
  const advancing = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPlayback = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (playback.current) playback.current.aborted = true;
    playback.current = null;
    stopAyah();
  }, []);

  const playThenListen = useCallback(
    async (a: number) => {
      if (!passage) return;
      cancelPlayback();
      const signal = { aborted: false };
      playback.current = signal;
      advancing.current = false;
      rec.setMuted(true);
      setLearnAyah(a);
      setAudioError(false);
      setTurn("loading");
      const { reciter, learnRepeat } = settings;
      prefetch(
        reciter,
        passage.surah,
        [a + 1, a + 2].filter((x) => x <= passage.toAyah),
      );
      try {
        for (let i = 0; i < learnRepeat && !signal.aborted; i++) {
          const playing = playAyah(reciter, passage.surah, a, signal);
          setTurn("playing");
          if (!(await playing)) return;
        }
      } catch {
        if (signal.aborted) return;
        setAudioError(true);
      }
      if (signal.aborted) return;
      // A short beat so the end of the recording isn't picked up as the reciter's voice.
      await new Promise((res) => setTimeout(res, 300));
      if (signal.aborted) return;
      rec.setMuted(false);
      setTurn("yours");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passage, settings.reciter, settings.learnRepeat, cancelPlayback],
  );

  // When the reciter finishes the ayah, play the next one (or finish at the end of the passage).
  useEffect(() => {
    if (!learn || !passage || turn !== "yours" || advancing.current) return;
    if (!ayahFinished(state, passage.surah, learnAyah)) return;
    advancing.current = true;
    const last = learnAyah >= passage.toAyah;
    if (last) rec.setMuted(true);
    // Kept in a ref, not the effect's cleanup: new engine events keep arriving and must not cancel the advance.
    advanceTimer.current = setTimeout(() => (last ? setTurn("done") : playThenListen(learnAyah + 1)), last ? 0 : 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.version, turn, learnAyah]);

  useEffect(() => () => cancelPlayback(), [cancelPlayback]);
  const [selected, setSelected] = useState<Mistake | null>(null);
  // Hidden words the reciter revealed with the hint button (or by tapping them).
  const [hinted, setHinted] = useState<Set<string>>(() => new Set());
  const reveal = useCallback(
    (w: WordRef) => {
      setHinted((prev) => new Set(prev).add(`${w.surah}:${w.ayah}:${w.word}`));
      if (settings.haptics) Haptics.selectionAsync().catch(() => {});
    },
    [settings.haptics],
  );
  const onHint = () => {
    if (!passage) return;
    const next = nextHiddenWord(state, passage, hinted);
    if (next) reveal(next);
  };
  const list = useRef<FlatList<AyahId>>(null);

  // Which ayahs to show: the declared passage, or the surah the reciter is in.
  const followSurah = state.current?.surah ?? null;
  const ayahs: AyahId[] = useMemo(() => {
    if (passage) return ayahRange({ surah: passage.surah, ayah: passage.fromAyah }, { surah: passage.surah, ayah: passage.toAyah });
    if (followSurah) return ayahRange({ surah: followSurah, ayah: 1 }, { surah: followSurah, ayah: surah(followSurah).ayahs });
    return [];
  }, [passage, followSurah]);

  // Keep the current ayah in view.
  const focus: WordRef | null =
    learn && passage && turn !== "idle" && turn !== "yours" ? { surah: passage.surah, ayah: learnAyah, word: 1 } : (state.current ?? state.expected);
  const focusIndex = focus ? ayahs.findIndex((x) => x.surah === focus.surah && x.ayah === focus.ayah) : -1;
  useEffect(() => {
    if (focusIndex >= 0) list.current?.scrollToIndex({ index: focusIndex, viewPosition: 0.3, animated: true });
  }, [focusIndex]);

  const mistakes = useMemo(
    () => [...state.mistakes.values()].filter((m) => m.state === "confirmed" || m.state === "suspected").sort((a, b) => a.timeMs - b.timeMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec.version],
  );
  const confirmedCount = mistakes.filter((m) => m.state === "confirmed").length;

  const onOrb = useCallback(async () => {
    if (phase === "listening") {
      cancelPlayback();
      const id = await rec.stop([...hinted]);
      if (id && params.wird === "1") {
        const saved = getSession(id);
        if (saved) advanceWird(finishedAyahs(saved.ayahs, saved.recited ?? [], saved.hints));
      }
      if (id) router.replace(`/session/${id}`);
      else router.back();
    } else if (phase === "ready" || phase === "error") {
      setSelected(null);
      setHinted(new Set());
      if (learn && passage) {
        rec.setMuted(true);
        await rec.start();
        playThenListen(passage.fromAyah);
      } else rec.start();
    }
  }, [phase, rec, router, hinted, learn, passage, playThenListen, cancelPlayback, params.wird]);

  const statusText = (() => {
    if (phase === "preparing") return t("recite.preparing");
    if (phase === "starting") return t("recite.starting");
    if (phase === "finishing") return t("recite.finishing");
    if (phase === "ready" || phase === "done") return learn ? t("recite.learnReady") : mode === "hifz" ? t("recite.hifzReady") : t("recite.ready");
    if (learn && phase === "listening") {
      if (audioError && turn === "yours") return t("recite.audioError");
      if (turn === "loading") return t("recite.learnDownloading");
      if (turn === "playing") return t("recite.learnPlaying", { n: num(learnAyah) });
      if (turn === "yours") return t("recite.learnYourTurn", { n: num(learnAyah) });
      if (turn === "done") return t("recite.learnDone");
    }
    if (phase === "error") return rec.error === "mic-denied" ? t("recite.micDenied") : `${t("recite.error")}: ${rec.error}`;
    switch (state.tracker) {
      case "locked":
        return state.current
          ? `${t("recite.following")} · ${lang === "ar" ? surah(state.current.surah).ar : surah(state.current.surah).en} ${num(state.current.ayah)}`
          : t("recite.acquiring");
      case "ambiguous":
        return t("recite.ambiguous");
      case "lost":
        return t("recite.lost");
      case "acquiring":
        return t("recite.locating");
      default:
        return t("recite.acquiring");
    }
  })();
  const statusColor =
    phase === "error" || (learn && audioError && turn === "yours")
      ? c.danger
      : learn && listening
        ? turn === "playing" || turn === "loading"
          ? c.gold
          : c.primary
        : state.tracker === "locked"
          ? c.primary
          : state.tracker === "lost" || state.tracker === "ambiguous"
            ? c.warn
            : c.textMuted;

  const title = learn ? t("recite.learn") : mode === "hifz" ? t("recite.hifz") : mode === "passage" ? t("recite.passage") : t("recite.free");
  const subtitle = passage
    ? `${lang === "ar" ? `سورة ${surah(passage.surah).ar}` : surah(passage.surah).en} · ${num(passage.fromAyah)}–${num(passage.toAyah)}`
    : t("recite.offline");

  const renderItem = useCallback(
    ({ item }: { item: AyahId }) => {
      const showHeader = item.ayah === 1 || (passage && item.ayah === passage.fromAyah);
      return (
        <View style={{ paddingHorizontal: space(2.5) }}>
          {showHeader && (
            <>
              <SurahHeader n={item.surah} compact />
              {item.ayah === 1 && item.surah !== 1 && item.surah !== 9 && <Basmala fontSize={settings.fontSize} />}
            </>
          )}
          <AyahBlock
            surah={item.surah}
            ayah={item.ayah}
            fontSize={settings.fontSize}
            statuses={statusesFor(state, item.surah, item.ayah, hinted)}
            hide={hide}
            highlight={!!focus && focus.surah === item.surah && focus.ayah === item.ayah && listening}
            onWordPress={(w) => {
              const m = state.byWord.get(`${item.surah}:${item.ayah}:${w}`);
              if (m) setSelected(m);
              else if (hide !== "none" && wordStatus(state, item.surah, item.ayah, w) === "pending")
                reveal({ surah: item.surah, ayah: item.ayah, word: w });
            }}
          />
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec.version, settings.fontSize, hide, passage, listening, focus?.surah, focus?.ayah, hinted],
  );

  return (
    <Screen edges={["top", "bottom"]}>
      <Header
        back
        title={title}
        subtitle={subtitle}
        trailing={
          <View style={[styles.badge, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={c.primary} />
          </View>
        }
      />

      <Animated.View layout={LinearTransition} style={[styles.status, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <T v="label" color={statusColor} style={{ flex: 1 }} numberOfLines={2}>
          {statusText}
        </T>
        {phase === "error" && rec.error === "mic-denied" && (
          <Tap onPress={() => Linking.openSettings()}>
            <T v="label" color={c.primary}>
              {t("recite.openSettings")}
            </T>
          </Tap>
        )}
      </Animated.View>

      <View style={{ flex: 1 }}>
        {ayahs.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.empty}>
            <T center style={{ fontFamily: fonts.quran, fontSize: 40, lineHeight: 90, color: c.gold }}>
              ﴿ وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا ﴾
            </T>
            <T center muted style={{ marginTop: space(1), paddingHorizontal: space(4) }}>
              {t("recite.readyHint")}
            </T>
          </Animated.View>
        ) : (
          <FlatList
            ref={list}
            data={ayahs}
            keyExtractor={(x) => `${x.surah}:${x.ayah}`}
            renderItem={renderItem}
            extraData={rec.version}
            contentContainerStyle={{ paddingVertical: space(2), paddingBottom: 200 }}
            ItemSeparatorComponent={() => <View style={{ height: space(1) }} />}
            onScrollToIndexFailed={(info) =>
              setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.3, animated: true }), 120)
            }
            initialNumToRender={8}
            windowSize={9}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Bottom dock */}
      <View style={[styles.dock, { backgroundColor: c.bg }]}>
        {selected && (
          <Animated.View
            entering={FadeInDown.duration(240)}
            exiting={FadeOutDown.duration(160)}
            style={[styles.detail, { backgroundColor: c.surface, borderColor: selected.state === "confirmed" ? c.danger : c.warn }]}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <T v="label" color={selected.state === "confirmed" ? c.danger : c.warn}>
                {t(
                  `errorClass.${["wrong_word", "omitted_word", "added_word", "skipped_passage"].includes(selected.errorClass) ? selected.errorClass : "other"}`,
                )}
              </T>
              <Tap onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={18} color={c.textMuted} />
              </Tap>
            </Row>
            {selected.errorClass !== "added_word" && (
              <Row style={{ marginTop: 4 }}>
                <T v="caption" muted>
                  {t("recite.expectedWord")}:
                </T>
                <T style={{ fontFamily: fonts.quran, fontSize: 24, lineHeight: 46, color: c.text }}>
                  {wordAt(selected.location.surah, selected.location.ayah, selected.location.word) ?? ""}
                </T>
                <T v="caption" muted>
                  ({num(selected.location.ayah)})
                </T>
              </Row>
            )}
          </Animated.View>
        )}

        {mistakes.length > 0 && (
          <FlatList
            horizontal
            data={mistakes}
            inverted={lang === "ar"}
            keyExtractor={(m) => m.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: space(2) }}
            style={{ flexGrow: 0, marginBottom: space(1) }}
            renderItem={({ item }) => (
              <Animated.View entering={FadeIn} layout={LinearTransition}>
                <Chip
                  label={`${wordAt(item.location.surah, item.location.ayah, item.location.word) ?? "…"}`}
                  icon={item.state === "confirmed" ? "alert-circle" : "help-circle"}
                  color={item.state === "confirmed" ? c.danger : c.warn}
                  bg={item.state === "confirmed" ? c.dangerSoft : c.warnSoft}
                  onPress={() => setSelected(item)}
                />
              </Animated.View>
            )}
          />
        )}

        <Row style={{ justifyContent: "space-between", paddingHorizontal: space(3) }}>
          <View style={{ width: learn ? 100 : 90, gap: 6 }}>
            <T v="caption" muted>
              {listening ? tc("recite.mistakes", confirmedCount) : ""}
            </T>
            {listening && learn && (
              <Row gap={8}>
                <IconButton
                  icon={turn === "playing" ? "volume-high" : "repeat"}
                  label={t("recite.replay")}
                  tint={c.gold}
                  bg={c.goldSoft}
                  onPress={() => playThenListen(learnAyah)}
                />
                {passage && learnAyah < passage.toAyah && (
                  <IconButton
                    icon="play-skip-forward"
                    label={t("recite.nextAyah")}
                    tint={c.primary}
                    bg={c.primarySoft}
                    onPress={() => playThenListen(learnAyah + 1)}
                  />
                )}
              </Row>
            )}
            {listening && hide !== "none" && (
              <Tap
                onPress={onHint}
                accessibilityLabel={t("recite.hintA11y")}
                style={[styles.hint, { backgroundColor: c.goldSoft, borderColor: c.gold }]}
              >
                <Ionicons name="bulb-outline" size={18} color={c.gold} />
                <T v="label" color={c.gold}>
                  {hinted.size ? `${t("recite.hint")} ${num(hinted.size)}` : t("recite.hint")}
                </T>
              </Tap>
            )}
          </View>
          <MicOrb
            listening={listening}
            busy={phase === "preparing" || phase === "starting" || phase === "finishing"}
            level={rec.level}
            onPress={onOrb}
            label={listening ? t("recite.stop") : t("home.startReciting")}
          />
          <View style={{ width: 90, alignItems: "flex-end" }}>
            {listening && <Button title={t("recite.stop")} kind="secondary" onPress={onOrb} style={{ height: 40, paddingHorizontal: 14 }} />}
          </View>
        </Row>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: space(2),
    paddingHorizontal: space(2),
    paddingVertical: space(1.25),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space(8) },
  dock: { paddingBottom: space(1), paddingTop: space(1) },
  detail: { marginHorizontal: space(2), marginBottom: space(1), padding: space(1.5), borderRadius: radius.md, borderWidth: 1 },
});
