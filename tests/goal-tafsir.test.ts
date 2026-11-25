/** Unit tests for the daily-goal arithmetic and the tafsir text helpers. Run: npm test. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountsByDay, dayIndex, goalStreak } from "../src/state/goalMath.ts";
import { explanationFor, plainText } from "../src/quran/tafsirText.ts";

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
// A toy mushaf: every page holds 4 ayahs of surah 1 (ayahs 1-4 on page 1, 5-8 on page 2).
const pageOf = (_s: number, a: number) => Math.ceil(a / 4);
const pageSize = () => 4;

test("pages count as the share of each page recited that day", () => {
  const rows = [
    { started_at: at(2026, 1, 1, 8), duration_ms: 60_000, ayahs: JSON.stringify(["1:1", "1:2"]) },
    // Repeating ayahs later the same day doesn't count twice.
    { started_at: at(2026, 1, 1, 20), duration_ms: 120_000, ayahs: JSON.stringify(["1:2", "1:3", "1:4", "1:5"]) },
  ];
  const day = dayIndex(at(2026, 1, 1));
  assert.equal(amountsByDay(rows, "pages", pageOf, pageSize).get(day), 1.25);
  assert.equal(amountsByDay(rows, "ayahs", pageOf, pageSize).get(day), 5);
  assert.equal(amountsByDay(rows, "minutes", pageOf, pageSize).get(day), 3);
});

test("goal streak counts consecutive met days and survives an unfinished today", () => {
  const d = dayIndex(at(2026, 3, 10));
  const byDay = new Map([
    [d - 3, 1],
    [d - 2, 0.5], // missed: breaks the streak
    [d - 1, 1],
    [d, 0.4],
  ]);
  assert.equal(goalStreak(byDay, 1, d), 1); // yesterday only; today still open
  byDay.set(d, 1);
  assert.equal(goalStreak(byDay, 1, d), 2);
  assert.equal(goalStreak(new Map(), 1, d), 0);
});

test("plainText turns the API's HTML into paragraphs", () => {
  assert.equal(plainText("<h2>Title</h2><p>One &amp; two</p><p>Three<br/>four</p>"), "Title\n\nOne & two\n\nThree\nfour");
  assert.equal(plainText('ومن <span class="blue">الناس</span> فريق'), "ومن الناس فريق");
});

test("explanationFor finds the passage that covers grouped ayahs", () => {
  const data = { 1: "a", 2: "b", 3: "", 4: "", 5: "c" };
  assert.deepEqual(explanationFor(data, 1), { text: "a", from: 1, to: 1 });
  assert.deepEqual(explanationFor(data, 4), { text: "b", from: 2, to: 4 });
  assert.deepEqual(explanationFor(data, 2), { text: "b", from: 2, to: 4 });
  assert.equal(explanationFor({ 1: "" }, 1), null);
});

// A toy Quran of three surahs with 7, 3 and 2 ayahs.
const COUNTS = [7, 3, 2];

test("wird moves past the furthest ayah recited, never backwards", async () => {
  const { advance } = await import("../src/state/wirdMath.ts");
  assert.deepEqual(advance(COUNTS, { surah: 1, ayah: 3 }, ["1:3", "1:4", "1:5"]).pos, { surah: 1, ayah: 6 });
  // Revising earlier ayahs leaves it where it was.
  assert.deepEqual(advance(COUNTS, { surah: 1, ayah: 3 }, ["1:1", "1:2"]).pos, { surah: 1, ayah: 3 });
  // Finishing a surah continues with the next one.
  assert.deepEqual(advance(COUNTS, { surah: 1, ayah: 6 }, ["1:6", "1:7"]).pos, { surah: 2, ayah: 1 });
});

test("finishing the last ayah completes a khatma and starts again", async () => {
  const { advance, ordinal } = await import("../src/state/wirdMath.ts");
  assert.deepEqual(advance(COUNTS, { surah: 3, ayah: 1 }, ["3:1", "3:2"]), { pos: { surah: 1, ayah: 1 }, finished: true });
  assert.equal(ordinal(COUNTS, { surah: 3, ayah: 2 }), 11);
});
