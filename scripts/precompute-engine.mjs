#!/usr/bin/env node
/**
 * Build step: computes the Tilawa checker's index tables for the bundled Quran reference and saves them to
 * assets/tilawa/engine-tables.txt. The app loads them before creating the engine, which saves several seconds of
 * index building on a phone (see the @tilawa/core patch in patches/). Re-run after changing the reference or
 * upgrading @tilawa/core.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeIndexTables, loadReferenceIndex } from "@tilawa/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reference = JSON.parse(readFileSync(join(root, "assets", "tilawa", "ref-v2.txt"), "utf8"));

const t0 = performance.now();
const tables = computeIndexTables(loadReferenceIndex(reference));
const json = JSON.stringify(tables);
const out = join(root, "assets", "tilawa", "engine-tables.txt");
writeFileSync(out, json);
console.log(`✓ ${out.slice(root.length + 1)}: ${(json.length / 1e6).toFixed(2)} MB in ${(performance.now() - t0).toFixed(0)} ms`);
