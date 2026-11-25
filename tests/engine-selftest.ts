/**
 * End-to-end check on the desktop: the exact model files bundled in the APK, the Tilawa engine, and the app's
 * reducer, fed a real recitation of Ya-Sin 36:1–5 (tests/fixtures). Run: npm run selftest
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTilawa, loadNodeModel, readWav } from "@tilawa/core/node";
import { MODEL_REGISTRY } from "@tilawa/core";
import { applyEvents, confirmedMistakes, initialRecitation } from "../src/engine/recitation.ts";
import ref from "@tilawa/core/assets/ref-v2.json" with { type: "json" };

const root = join(import.meta.dirname, "..");
const cache = join(root, "node_modules", ".cache", "tilawati");
// Ya-Sin 36:1–5, from the Tilawa demo's end-to-end test fixtures.
const clip = join(root, "tests", "fixtures", "yasin-36-1-5.wav");

const wordsOf = new Map(ref.ayahs.map((a) => [a.s * 1000 + a.a, a.w.length]));
const ayahCount = (s: number) => ref.ayahs.filter((a) => a.s === s).length;

for (const tier of ["lite", "full"] as const) {
  // Load the same file the APK ships: assets/tilawa/<tier>.onnx in a directory layout loadNodeModel expects.
  const entry = MODEL_REGISTRY.tiers.find((t) => t.tier === tier)!;
  const dir = join(cache, tier);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, entry.manifest.file);
  if (!existsSync(target)) writeFileSync(target, readFileSync(join(root, "assets", "tilawa", `${tier}.onnx`)));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(entry.manifest));

  const t0 = Date.now();
  const model = await loadNodeModel(dir);
  const tilawa = await createTilawa({ model, tier });
  const session = tilawa.startFreeRecitation();
  const st = initialRecitation();
  session.subscribe((e) => applyEvents(st, [e], (s, a) => wordsOf.get(s * 1000 + a) ?? 0, ayahCount));

  const { samples, sampleRate } = await readWav(clip);
  const chunk = Math.round(sampleRate * 0.1);
  const started = Date.now();
  for (let i = 0; i < samples.length; i += chunk) session.pushAudio(samples.subarray(i, i + chunk), sampleRate);
  await session.end();
  const audioMs = (samples.length / sampleRate) * 1000;
  const rtf = (Date.now() - started) / audioMs;

  console.log(
    `${tier}: load ${Date.now() - t0 - (Date.now() - started)} ms · audio ${(audioMs / 1000).toFixed(1)} s · RTF ${rtf.toFixed(3)} · ` +
      `tracker ${st.tracker} · ayahs ${st.ayahs.join(" ")} · words ${st.recited.size} · mistakes ${confirmedMistakes(st).length}`,
  );
  assert.equal(tilawa.capabilities.supported.length, 4, "the model supports the 4 memorization classes");
  assert.ok(st.ayahs.includes("36:1") || st.ayahs.includes("36:2"), "the tracker locked onto Ya-Sin");
  assert.ok(st.ayahs.includes("36:5"), "it followed through to 36:5");
  assert.ok(st.recited.size >= 9, "most of the 12 words in 36:1–5 were followed");
  assert.equal(confirmedMistakes(st).length, 0, "a clean recitation raises no mistakes");
  await tilawa.dispose();
}
console.log("engine self-test passed");
