/**
 * Folds Tilawa engine events into what the screens draw: recited words, the current word, and mistakes by word.
 * Pure and mutable-for-speed; `version` bumps on every change so React can re-render cheaply.
 */
import type { CheckerEvent, EngineEvent, TrackerState, WordRef } from "@tilawa/core";

export type MistakeState = CheckerEvent["state"];
export type MistakeClass = CheckerEvent["errorClass"];

export interface Mistake {
  id: string;
  state: MistakeState;
  errorClass: MistakeClass;
  location: WordRef;
  expected?: string;
  observed?: string;
  confidence: number;
  timeMs: number;
}

export interface RecitationState {
  tracker: TrackerState | null;
  /** The most recently recited word, while the tracker is locked. */
  current: WordRef | null;
  /** Memorization sessions: the word the reciter should be on. */
  expected: WordRef | null;
  recited: Set<string>;
  /** "s:a" in the order the reciter first reached each ayah. */
  ayahs: string[];
  mistakes: Map<string, Mistake>;
  /** Latest open-or-confirmed mistake on each word ("s:a:w"). */
  byWord: Map<string, Mistake>;
  timeMs: number;
  version: number;
}

export const wordKey = (w: WordRef) => `${w.surah}:${w.ayah}:${w.word}`;
export const ayahKey = (s: number, a: number) => `${s}:${a}`;

export function initialRecitation(): RecitationState {
  return {
    tracker: null,
    current: null,
    expected: null,
    recited: new Set(),
    ayahs: [],
    mistakes: new Map(),
    byWord: new Map(),
    timeMs: 0,
    version: 0,
  };
}

type WordCount = (surah: number, ayah: number) => number;
type AyahCount = (surah: number) => number;

const before = (a: WordRef, b: WordRef) => (a.surah !== b.surah ? a.surah < b.surah : a.ayah !== b.ayah ? a.ayah < b.ayah : a.word <= b.word);

/** Marks every word from `start` to `end` inclusive as recited. Spans can cross ayahs and surahs. */
function markSpan(st: RecitationState, start: WordRef, end: WordRef, words: WordCount, ayahs: AyahCount) {
  if (!before(start, end)) return;
  let { surah: s, ayah: a, word: w } = start;
  for (let guard = 0; guard < 4000; guard++) {
    const ak = ayahKey(s, a);
    if (!st.ayahs.includes(ak)) st.ayahs.push(ak);
    st.recited.add(`${s}:${a}:${w}`);
    if (s === end.surah && a === end.ayah && w === end.word) return;
    if (w < words(s, a)) w++;
    else if (a < ayahs(s)) {
      a++;
      w = 1;
    } else {
      s++;
      a = 1;
      w = 1;
      if (s > 114) return;
    }
  }
}

function reindexMistakes(st: RecitationState) {
  st.byWord.clear();
  for (const m of st.mistakes.values()) {
    if (m.state === "resolved" || m.state === "uncertain") continue;
    const k = wordKey(m.location);
    const prev = st.byWord.get(k);
    if (!prev || prev.state === "suspected") st.byWord.set(k, m);
  }
}

export interface ApplyResult {
  changed: boolean;
  newlyConfirmed: Mistake[];
}

export function applyEvents(st: RecitationState, events: EngineEvent[], words: WordCount, ayahs: AyahCount): ApplyResult {
  let changed = false;
  let mistakesChanged = false;
  const newlyConfirmed: Mistake[] = [];
  for (const e of events) {
    if (e.type === "position") {
      st.timeMs = e.timeMs;
      st.expected = e.expected;
      if (st.tracker !== e.state) {
        st.tracker = e.state;
        changed = true;
      }
      const best = e.observed[0];
      if (e.state === "locked" && best) {
        const moved = !st.current || wordKey(st.current) !== wordKey(best.word);
        // Only the tail of the span is new; the head was marked by earlier events.
        const from = st.current && before(best.span.start, st.current) && before(st.current, best.word) ? st.current : best.span.start;
        markSpan(st, from, best.word, words, ayahs);
        st.current = best.word;
        if (moved) changed = true;
      }
    } else if (e.type === "checker") {
      const prev = st.mistakes.get(e.id);
      const m: Mistake = {
        id: e.id,
        state: e.state,
        errorClass: e.errorClass,
        location: e.location,
        expected: e.expected,
        observed: e.observed,
        confidence: e.confidence,
        timeMs: e.timeMs,
      };
      st.mistakes.set(e.id, m);
      if (e.state === "confirmed" && prev?.state !== "confirmed") newlyConfirmed.push(m);
      mistakesChanged = true;
    }
  }
  if (mistakesChanged) reindexMistakes(st);
  if (changed || mistakesChanged) st.version++;
  return { changed: changed || mistakesChanged, newlyConfirmed };
}

/** `hint`: a hidden word the reciter asked to see (drawn by the screen, never produced by the engine). */
export type WordStatus = "pending" | "recited" | "current" | "suspected" | "confirmed" | "hint";

export function wordStatus(st: RecitationState, s: number, a: number, w: number): WordStatus {
  const k = `${s}:${a}:${w}`;
  const m = st.byWord.get(k);
  if (m) return m.state === "confirmed" ? "confirmed" : "suspected";
  if (st.current && st.current.surah === s && st.current.ayah === a && st.current.word === w) return "current";
  return st.recited.has(k) ? "recited" : "pending";
}

export function confirmedMistakes(st: RecitationState): Mistake[] {
  return [...st.mistakes.values()].filter((m) => m.state === "confirmed");
}
