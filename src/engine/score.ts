/**
 * The session score. Accuracy is counted per word, over the part of the passage the reciter actually covered:
 * a word counts as correct only if it was recited, has no mistake on it and wasn't revealed with a hint.
 * Words the tracker jumped over (skipped or missed) count against the score, and a hifz test stopped halfway is
 * scored on what was recited, with the rest shown as not reached.
 */
import type { Mistake } from "./recitation";

export interface ScorePassage {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

export interface ScoreInput {
  /** Declared passage (hifz and guided sessions); free sessions have none. */
  passage?: ScorePassage | null;
  /** "s:a:w" keys of the words the tracker followed. */
  recited: Iterable<string>;
  /** "s:a:w" keys of hidden words the reciter revealed. */
  hints?: Iterable<string>;
  /** Mistakes the engine counted (confirmed, plus self-corrections when the policy counts them). */
  mistakes: Pick<Mistake, "location" | "state">[];
  wordCount: (surah: number, ayah: number) => number;
}

export type WordResult = "correct" | "mistake" | "hint" | "missed" | "unreached";

export interface Score {
  /** 0–100, rounded down so a session with any mistake never shows 100. */
  accuracy: number;
  correct: number;
  /** Words scored (the covered part of the passage). */
  total: number;
  /** Words in the whole passage (free sessions: equal to `total`). */
  passageWords: number;
  mistakes: number;
  hints: number;
  missed: number;
  result: (surah: number, ayah: number, word: number) => WordResult;
}

const counted = (m: Pick<Mistake, "state">) => m.state === "confirmed" || m.state === "resolved";

export function scoreSession({ passage, recited, hints = [], mistakes, wordCount }: ScoreInput): Score {
  const rec = new Set(recited);
  const hint = new Set(hints);
  const bad = new Set(mistakes.filter(counted).map((m) => `${m.location.surah}:${m.location.ayah}:${m.location.word}`));

  const classify = (k: string): WordResult => (bad.has(k) ? "mistake" : hint.has(k) ? "hint" : rec.has(k) ? "correct" : "missed");

  let correct = 0;
  let total = 0;
  let nMistakes = 0;
  let nHints = 0;
  let missed = 0;
  let passageWords = 0;
  let lastReached = -1; // index of the last touched word in the passage

  const tally = (r: WordResult) => {
    total++;
    if (r === "correct") correct++;
    else if (r === "mistake") nMistakes++;
    else if (r === "hint") nHints++;
    else missed++;
  };

  let result: Score["result"];
  if (passage) {
    const keys: string[] = [];
    for (let a = passage.fromAyah; a <= passage.toAyah; a++) {
      const n = wordCount(passage.surah, a);
      for (let w = 1; w <= n; w++) keys.push(`${passage.surah}:${a}:${w}`);
    }
    passageWords = keys.length;
    keys.forEach((k, i) => {
      if (rec.has(k) || bad.has(k) || hint.has(k)) lastReached = i;
    });
    const reached = new Set(keys.slice(0, lastReached + 1));
    for (const k of reached) tally(classify(k));
    result = (s, a, w) => {
      const k = `${s}:${a}:${w}`;
      return reached.has(k) ? classify(k) : "unreached";
    };
  } else {
    const all = new Set([...rec, ...bad, ...hint]);
    for (const k of all) tally(classify(k));
    passageWords = total;
    result = (s, a, w) => {
      const k = `${s}:${a}:${w}`;
      return all.has(k) ? classify(k) : "unreached";
    };
  }

  return {
    accuracy: total ? Math.floor((100 * correct) / total) : 0,
    correct,
    total,
    passageWords,
    mistakes: nMistakes,
    hints: nHints,
    missed,
    result,
  };
}
