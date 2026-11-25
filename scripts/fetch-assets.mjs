#!/usr/bin/env node
/**
 * Dev-time: puts the Tilawa listener models and the Quran reference into assets/tilawa/ so they ship inside the APK.
 * Models come from https://tilawa.dev/v1/ and are checked against the sha256 in @tilawa/core's bundled registry.
 * Re-running skips files that are already present and verified.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = join(root, "node_modules", "@tilawa", "core");
const out = join(root, "assets", "tilawa");
const BASE = "https://tilawa.dev/v1/";
mkdirSync(out, { recursive: true });

const registry = JSON.parse(readFileSync(join(core, "dist", "runtime", "models-v1.json"), "utf8"));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

for (const t of registry.tiers) {
  const dest = join(out, `${t.tier}.onnx`);
  if (existsSync(dest) && sha(readFileSync(dest)) === t.sha256) {
    console.log(`✓ ${t.tier} (${t.id}@${t.version}) already present`);
    continue;
  }
  const url = BASE + t.base + t.manifest.file;
  console.log(`↓ ${t.tier}: ${url} (${(t.bytes / 1e6).toFixed(1)} MB)`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== t.bytes) throw new Error(`${t.tier}: got ${buf.length} bytes, expected ${t.bytes}`);
  if (sha(buf) !== t.sha256) throw new Error(`${t.tier}: sha256 mismatch`);
  writeFileSync(dest, buf);
  console.log(`✓ ${t.tier} verified`);
}

// The reference ships in the npm package; the app loads it as a raw asset (not a JS module) to keep the bundle small.
copyFileSync(join(core, "assets", "ref-v2.json"), join(out, "ref-v2.txt"));
console.log("✓ ref-v2 copied");
