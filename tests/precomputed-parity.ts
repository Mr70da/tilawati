/**
 * The precomputed index tables (assets/tilawa/engine-tables.txt) must make the engine behave exactly as tables it
 * builds itself. Replays a real recitation through free, declared and wrong-passage sessions both ways and compares
 * every event. Run: npm run parity
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_REGISTRY, setPrecomputedIndexes } from "@tilawa/core";
import type { EngineEvent, MemorizationPassage } from "@tilawa/core";
import { createTilawa, loadNodeModel, readWav } from "@tilawa/core/node";

const root = join(import.meta.dirname, "..");
const reference = JSON.parse(readFileSync(join(root, "assets", "tilawa", "ref-v2.txt"), "utf8"));
const tables = JSON.parse(readFileSync(join(root, "assets", "tilawa", "engine-tables.txt"), "utf8"));
const { samples, sampleRate } = await readWav(join(root, "tests", "fixtures", "yasin-36-1-5.wav"));

const entry = MODEL_REGISTRY.tiers.find((t) => t.tier === "lite")!;
const dir = join(root, "node_modules", ".cache", "tilawati", "parity-lite");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, entry.manifest.file), readFileSync(join(root, "assets", "tilawa", "lite.onnx")));
writeFileSync(join(dir, "manifest.json"), JSON.stringify(entry.manifest));

const sessions: (MemorizationPassage | null)[] = [null, { surah: 36, fromAyah: 1, toAyah: 5 }, { surah: 36, fromAyah: 8, toAyah: 12 }];

async function run(label: string) {
  const model = await loadNodeModel(dir);
  const tilawa = await createTilawa({ model, reference });
  const out: string[] = [];
  for (const passage of sessions) {
    const t0 = performance.now();
    const session = passage ? tilawa.startMemorization(passage) : tilawa.startFreeRecitation();
    const created = performance.now() - t0;
    const events: EngineEvent[] = [];
    session.subscribe((e) => events.push(e));
    const chunk = Math.round(sampleRate / 10);
    for (let i = 0; i < samples.length; i += chunk) session.pushAudio(samples.subarray(i, i + chunk), sampleRate);
    await session.end();
    // Mistake ids are random uuids: number them by first appearance so the two runs compare.
    const ids = new Map<string, number>();
    const normalized = events.map((e) => (e.type === "checker" ? { ...e, id: ids.get(e.id) ?? ids.set(e.id, ids.size).get(e.id) } : e));
    const checks = events.filter((e) => e.type === "checker").length;
    console.log(
      `${label.padEnd(12)} ${(passage ? `${passage.surah}:${passage.fromAyah}-${passage.toAyah}` : "free").padEnd(9)} session ${created.toFixed(0).padStart(4)} ms · ${events.length} events · ${checks} checker`,
    );
    out.push(JSON.stringify(normalized));
    session.dispose();
  }
  await tilawa.dispose();
  return out;
}

setPrecomputedIndexes(null);
const built = await run("built");
setPrecomputedIndexes(tables);
const loaded = await run("precomputed");
setPrecomputedIndexes(null);

for (let i = 0; i < sessions.length; i++) assert.equal(loaded[i], built[i], `session ${i}: events differ`);
console.log("parity passed: identical events with precomputed tables");
