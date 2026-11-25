/**
 * One recitation take: microphone (16 kHz float PCM) → Tilawa session → screen state, then saved to history.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { AudioStudioModule, useAudioRecorder } from "@siteed/audio-studio";
import type { AudioDataEvent, RecordingConfig } from "@siteed/audio-studio";
import { useSharedValue } from "react-native-reanimated";
import { File } from "expo-file-system";
import type { EngineEvent, SessionPolicy, TilawaSession } from "@tilawa/core";
import type { Tilawa } from "@tilawa/core/react-native";
import { saveSession } from "@/db";
import type { SessionMode } from "@/db";
import { ayahWords, surah } from "@/quran";
import { getSettings } from "@/state/settings";
import { resolveTier } from "./bundled";
import { applyEvents, initialRecitation } from "./recitation";
import type { Mistake, RecitationState } from "./recitation";
import { ensureWarm, getTilawa, isWarm } from "./service";
import { decodePcm16Wav } from "./wav";

export type Phase = "preparing" | "ready" | "starting" | "listening" | "finishing" | "done" | "error";

export interface Passage {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

export interface UseRecitationOptions {
  mode: SessionMode;
  passage?: Passage;
  /** Dev only: feed this WAV file in real time instead of the microphone (emulator testing). */
  simulateUri?: string;
}

const KEEP_AWAKE_TAG = "tilawati-recitation";
const wordCount = (s: number, a: number) => ayahWords(s, a).length;
const ayahCount = (s: number) => surah(s)?.ayahs ?? 0;

export function useRecitation({ mode, passage, simulateUri }: UseRecitationOptions) {
  // Engine state lives in a mutable ref for speed; keep this hook out of the React Compiler's auto-memoization.
  "use no memo";
  const [phase, setPhase] = useState<Phase>("preparing");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<RecitationState>(initialRecitation);
  const state = useRef<RecitationState>(snapshot);
  const session = useRef<TilawaSession | null>(null);
  const tierRef = useRef<string>("lite");
  const frame = useRef<number | null>(null);
  /** Microphone level 0..1 for the animated orb (updated off the React render path). */
  const level = useSharedValue(0);
  const recorder = useAudioRecorder();
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** A session created ahead of the tap, so starting only has to open the microphone. */
  const pending = useRef<TilawaSession | null>(null);
  const starting = useRef(false);
  /** While true, microphone samples are dropped (the app is playing recitation audio and must not hear itself). */
  const muted = useRef(false);
  const setMuted = useCallback((on: boolean) => {
    muted.current = on;
    if (on) level.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Where microphone samples go; set when a take starts. The config stays stable so it can be prepared early. */
  const feedRef = useRef<((samples: Float32Array) => void) | null>(null);
  const recordConfig = useRef<RecordingConfig>({
    sampleRate: 16000,
    channels: 1,
    encoding: "pcm_32bit",
    streamFormat: "float32",
    interval: 100,
    output: { primary: { enabled: false } },
    onAudioStream: async (ev: AudioDataEvent) => {
      const samples = ev.data as Float32Array;
      if (samples instanceof Float32Array && samples.length > 0) feedRef.current?.(samples);
    },
  });

  // Warm the engine as soon as the screen opens.
  useEffect(() => {
    let alive = true;
    const s = getSettings();
    tierRef.current = resolveTier(s.tier);
    getTilawa(s.tier)
      .then(async (tilawa) => {
        if (!alive) return;
        // First recitation since launch and the idle warm-up hasn't run: do it now, after "preparing" has painted.
        if (!isWarm(tilawa)) {
          await new Promise((r) => setTimeout(r, 80));
          if (!alive) return;
          ensureWarm(tilawa);
        }
        pending.current ??= createSession(tilawa);
        setPhase((p) => (p === "preparing" ? "ready" : p));
        // Open the audio input ahead of the tap (only when permission is already granted: no prompt on arrival).
        if (!simulateUri)
          AudioStudioModule.getPermissionsAsync()
            .then((p: { granted?: boolean } | null) => (alive && p?.granted ? recorder.prepareRecording(recordConfig.current) : undefined))
            .catch(() => {});
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const render = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      // A new top-level object per frame, so anything memoized on it re-renders.
      setSnapshot({ ...state.current });
    });
  }, []);

  const onEvents = useCallback(
    (events: EngineEvent[]) => {
      const { changed, newlyConfirmed } = applyEvents(state.current, events, wordCount, ayahCount);
      if (newlyConfirmed.length && getSettings().haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (changed) render();
    },
    [render],
  );

  /** A session for this screen's mode and the current settings, already wired to the screen state. */
  const createSession = (tilawa: Tilawa): TilawaSession => {
    const s = getSettings();
    const policy: SessionPolicy = {
      confirm: s.confirm === "next-word" ? { after: "next-word" } : { after: "delay", ms: 2500 },
      countSelfCorrections: s.countSelfCorrections,
    };
    const sess = mode !== "free" && passage ? tilawa.startMemorization(passage, policy) : tilawa.startFreeRecitation(policy);
    sess.subscribe((e) => onEvents([e]));
    return sess;
  };

  const start = useCallback(async () => {
    // Ignore taps while a start is in flight or a take is running: one tap, one session.
    if (starting.current || session.current) return;
    starting.current = true;
    setError(null);
    setPhase("starting");
    const tapAt = Date.now();
    try {
      const perm = simulateUri ? { granted: true } : await AudioStudioModule.requestPermissionsAsync();
      if (!perm?.granted) {
        setError("mic-denied");
        setPhase("error");
        return;
      }
      const tilawa = await getTilawa(getSettings().tier);
      const sess = pending.current ?? createSession(tilawa);
      pending.current = null;
      state.current = initialRecitation();
      setSnapshot({ ...state.current });
      session.current = sess;
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});

      const feed = (samples: Float32Array, rate: number) => {
        if (muted.current) return;
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        level.set(Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 55) / 45)));
        sess.pushAudio(samples, rate).catch(() => {});
      };
      if (__DEV__ && simulateUri) {
        const { samples, sampleRate } = decodePcm16Wav(await new File(simulateUri).bytes());
        const chunk = Math.round(sampleRate / 10);
        let i = 0;
        const t0 = Date.now();
        simTimer.current = setInterval(() => {
          if (i >= samples.length) {
            if (simTimer.current) clearInterval(simTimer.current);
            simTimer.current = null;
            sess
              .idle()
              .then(() =>
                console.log(
                  `[selftest] ${(samples.length / sampleRate).toFixed(1)} s audio processed; wall ${Date.now() - t0} ms; ayahs ${state.current.ayahs.join(" ")}; words ${state.current.recited.size}; tracker ${state.current.tracker}`,
                ),
              );
            return;
          }
          feed(samples.subarray(i, i + chunk), sampleRate);
          i += chunk;
        }, 100);
        setStartedAt(Date.now());
        setPhase("listening");
        return;
      }
      feedRef.current = (samples) => feed(samples, 16000);
      await recorder.startRecording(recordConfig.current);
      setStartedAt(Date.now());
      setPhase("listening");
      console.log(`[tilawati] microphone open ${Date.now() - tapAt} ms after the tap`);
    } catch (e) {
      session.current?.dispose();
      session.current = null;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      starting.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, passage, simulateUri, onEvents, recorder, level]);

  /** Stops the microphone, lets the engine decide open mistakes, and saves the take. Returns the saved id. */
  const stop = useCallback(
    async (hints: string[] = []): Promise<string | null> => {
      const sess = session.current;
      if (!sess) return null;
      setPhase("finishing");
      level.set(0);
      try {
        if (simTimer.current) clearInterval(simTimer.current);
        simTimer.current = null;
        if (!simulateUri) await recorder.stopRecording().catch(() => {});
        deactivateKeepAwake(KEEP_AWAKE_TAG);
        await sess.end().catch(() => []);
        const st = state.current;
        const durationMs = startedAt ? Date.now() - startedAt : sess.now();
        // The engine's own verdict: confirmed mistakes, plus self-corrections when the policy counts them.
        const mistakes: Mistake[] = sess.mistakes().map((e) => ({
          id: e.id,
          state: e.state,
          errorClass: e.errorClass,
          location: e.location,
          expected: e.expected,
          observed: e.observed,
          confidence: e.confidence,
          timeMs: e.timeMs,
        }));
        const id = sess.id;
        session.current = null;
        sess.dispose();
        if (st.recited.size === 0 && mistakes.length === 0) {
          setPhase("done");
          return null;
        }
        saveSession(
          {
            id,
            mode,
            surah: passage?.surah ?? (st.ayahs[0] ? Number(st.ayahs[0].split(":")[0]) : null),
            fromAyah: passage?.fromAyah ?? null,
            toAyah: passage?.toAyah ?? null,
            startedAt: startedAt ?? Date.now(),
            durationMs,
            tier: tierRef.current,
            ayahs: st.ayahs,
            wordsRecited: st.recited.size,
            recited: [...st.recited],
            hints,
          },
          mistakes,
        );
        setSavedId(id);
        setPhase("done");
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
        return null;
      }
    },
    [mode, passage, simulateUri, recorder, startedAt, level],
  );

  // Leaving the screen mid-take discards it.
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      pending.current?.dispose();
      pending.current = null;
      const sess = session.current;
      if (sess) {
        session.current = null;
        if (simTimer.current) clearInterval(simTimer.current);
        recorder.stopRecording().catch(() => {});
        deactivateKeepAwake(KEEP_AWAKE_TAG);
        sess.dispose();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { phase, error, state: snapshot, version: snapshot.version, level, start, stop, setMuted, savedId, startedAt };
}
