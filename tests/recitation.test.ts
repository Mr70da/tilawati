/** Unit tests for the engine-event reducer. Run: npm test (Node's built-in runner, native TypeScript stripping). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EngineEvent } from "@tilawa/core";
import { applyEvents, initialRecitation, wordStatus } from "../src/engine/recitation.ts";

// Al-Fatiha word counts per ayah (ref-v2), and surah ayah counts for the two surahs these tests touch.
const FATIHA = [4, 4, 2, 3, 4, 3, 9];
const words = (s: number, a: number) => (s === 1 ? FATIHA[a - 1] : 7);
const ayahs = (s: number) => (s === 1 ? 7 : 286);

const pos = (
  state: "acquiring" | "locked" | "ambiguous" | "lost",
  start: [number, number, number],
  end: [number, number, number],
  timeMs = 0,
): EngineEvent =>
  ({
    type: "position",
    v: 1,
    timeMs,
    referenceVersion: "ref-v2",
    expected: null,
    state,
    observed: [
      {
        word: { surah: end[0], ayah: end[1], word: end[2] },
        span: { start: { surah: start[0], ayah: start[1], word: start[2] }, end: { surah: end[0], ayah: end[1], word: end[2] } },
        confidence: 0.9,
        cost: 0,
        per: 0,
      },
    ],
  }) as EngineEvent;

const chk = (id: string, state: "suspected" | "confirmed" | "resolved" | "uncertain", w: [number, number, number]): EngineEvent =>
  ({
    type: "checker",
    v: 1,
    id,
    timeMs: 0,
    state,
    errorClass: "wrong_word",
    location: { surah: w[0], ayah: w[1], word: w[2] },
    confidence: 0.8,
  }) as EngineEvent;

test("a locked span marks every word across ayahs as recited", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 2, 2])], words, ayahs);
  assert.equal(st.recited.size, 4 + 2);
  assert.deepEqual(st.ayahs, ["1:1", "1:2"]);
  assert.equal(wordStatus(st, 1, 2, 2), "current");
  assert.equal(wordStatus(st, 1, 1, 3), "recited");
  assert.equal(wordStatus(st, 1, 2, 3), "pending");
});

test("positions while acquiring do not mark words", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("acquiring", [1, 1, 1], [1, 1, 3])], words, ayahs);
  assert.equal(st.recited.size, 0);
  assert.equal(st.tracker, "acquiring");
});

test("spans cross into the next surah", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("locked", [1, 7, 8], [2, 1, 1])], words, ayahs);
  assert.ok(st.recited.has("1:7:9"));
  assert.ok(st.recited.has("2:1:1"));
  assert.deepEqual(st.ayahs, ["1:7", "2:1"]);
});

test("mistakes go suspected → confirmed and report the confirmation once", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 1, 4])], words, ayahs);
  let r = applyEvents(st, [chk("m1", "suspected", [1, 1, 3])], words, ayahs);
  assert.equal(r.newlyConfirmed.length, 0);
  assert.equal(wordStatus(st, 1, 1, 3), "suspected");
  r = applyEvents(st, [chk("m1", "confirmed", [1, 1, 3])], words, ayahs);
  assert.equal(r.newlyConfirmed.length, 1);
  assert.equal(wordStatus(st, 1, 1, 3), "confirmed");
  r = applyEvents(st, [chk("m1", "confirmed", [1, 1, 3])], words, ayahs);
  assert.equal(r.newlyConfirmed.length, 0);
});

test("a self-correction clears the word's mistake mark", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 1, 4]), chk("m2", "suspected", [1, 1, 2])], words, ayahs);
  applyEvents(st, [chk("m2", "resolved", [1, 1, 2])], words, ayahs);
  assert.equal(wordStatus(st, 1, 1, 2), "recited");
});

test("version bumps only on visible changes", () => {
  const st = initialRecitation();
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 1, 2])], words, ayahs);
  const v = st.version;
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 1, 2], 40)], words, ayahs);
  assert.equal(st.version, v);
  applyEvents(st, [pos("locked", [1, 1, 1], [1, 1, 3], 80)], words, ayahs);
  assert.equal(st.version, v + 1);
});

// ---------- session score ----------
import { scoreSession } from "../src/engine/score.ts";

const fatiha = { surah: 1, fromAyah: 1, toAyah: 7 };
const keysOf = (from: [number, number], to: [number, number]) => {
  const out: string[] = [];
  for (let a = from[0]; a <= to[0]; a++)
    for (let w = a === from[0] ? from[1] : 1; w <= (a === to[0] ? to[1] : FATIHA[a - 1]); w++) out.push(`1:${a}:${w}`);
  return out;
};

test("score: a clean full recitation is 100%", () => {
  const s = scoreSession({ passage: fatiha, recited: keysOf([1, 1], [7, 9]), mistakes: [], wordCount: words });
  assert.equal(s.total, 29);
  assert.equal(s.accuracy, 100);
});

test("score: one confirmed mistake never rounds up to 100%", () => {
  const s = scoreSession({
    passage: fatiha,
    recited: keysOf([1, 1], [7, 9]),
    mistakes: [{ state: "confirmed", location: { surah: 1, ayah: 7, word: 9 } }],
    wordCount: words,
  });
  assert.equal(s.mistakes, 1);
  assert.equal(s.accuracy, 96);
});

test("score: skipped words, hints and self-corrections count; unreached words don't", () => {
  // Recited 1:1–1:3 but jumped over ayah 2, used a hint on 3:1, self-corrected 3:2, then stopped.
  const recited = [...keysOf([1, 1], [1, 4]), ...keysOf([3, 1], [3, 2])];
  const s = scoreSession({
    passage: fatiha,
    recited,
    hints: ["1:3:1"],
    mistakes: [
      { state: "resolved", location: { surah: 1, ayah: 3, word: 2 } },
      { state: "suspected", location: { surah: 1, ayah: 1, word: 1 } },
    ],
    wordCount: words,
  });
  assert.equal(s.total, 10); // ayahs 1–3 (4 + 4 + 2)
  assert.equal(s.missed, 4);
  assert.equal(s.hints, 1);
  assert.equal(s.mistakes, 1);
  assert.equal(s.correct, 4);
  assert.equal(s.accuracy, 40);
  assert.equal(s.result(1, 5, 1), "unreached");
});
