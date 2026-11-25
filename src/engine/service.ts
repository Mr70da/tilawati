/**
 * One Tilawa instance for the whole app: the bundled model and reference are loaded once, offline, and reused by
 * every session. Changing the model tier in Settings disposes the old instance and loads the other model.
 */
import { createTilawa } from "@tilawa/core/react-native";
import type { Tilawa } from "@tilawa/core/react-native";
import type { LoadedModel, TierName } from "@tilawa/core";
import { loadBundledEngineTables, loadBundledModel, loadBundledReference, resolveTier } from "./bundled";
import type { TierChoice } from "./bundled";

export type EngineStatus =
  | { kind: "idle" }
  | { kind: "loading"; tier: TierName }
  | { kind: "ready"; tier: TierName; backend: string; loadMs: number }
  | { kind: "error"; message: string };

let current: { tier: TierName; promise: Promise<Tilawa>; model?: LoadedModel } | null = null;
let status: EngineStatus = { kind: "idle" };
const listeners = new Set<(s: EngineStatus) => void>();

function setStatus(s: EngineStatus) {
  status = s;
  for (const l of listeners) l(s);
}

export function engineStatus(): EngineStatus {
  return status;
}

export function subscribeEngine(fn: (s: EngineStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The engine sets up its Quran-wide indexes (word forms, similar passages, slot spans) on the first session it creates.
 * They are precomputed at build time and loaded from assets/tilawa/engine-tables.txt, so this costs about a second on
 * a phone instead of eight. Pay it once, here, with a throwaway session, so the first tap on the mic starts at once.
 */
const warmed = new WeakSet<Tilawa>();

/**
 * Runs the one-time index build if it hasn't run for this engine. It blocks the JS thread for a few seconds on a
 * phone, so callers pick the moment: when the user is idle, or behind the recite screen's "preparing" state.
 */
export function ensureWarm(tilawa: Tilawa) {
  if (warmed.has(tilawa)) return;
  warmed.add(tilawa);
  const t0 = Date.now();
  // One session is enough: free and memorization sessions share the same per-index tables.
  tilawa.startFreeRecitation().dispose();
  console.log(`[tilawati] engine indexes built in ${Date.now() - t0} ms`);
}

export function isWarm(tilawa: Tilawa): boolean {
  return warmed.has(tilawa);
}

/** The ready engine for this tier choice; loads it (once) if needed. */
export function getTilawa(choice: TierChoice): Promise<Tilawa> {
  const tier = resolveTier(choice);
  if (current && current.tier === tier) return current.promise;
  const previous = current;
  const t0 = Date.now();
  setStatus({ kind: "loading", tier });
  const entry: NonNullable<typeof current> = { tier, promise: null as unknown as Promise<Tilawa> };
  entry.promise = (async () => {
    if (previous) {
      const old = await previous.promise.catch(() => null);
      await old?.dispose().catch(() => {});
      await previous.model?.backend.release().catch(() => {});
    }
    const [{ model }, reference] = await Promise.all([loadBundledModel(tier), loadBundledReference(), loadBundledEngineTables()]);
    entry.model = model;
    const tilawa = await createTilawa({ model, reference, tier });
    setStatus({ kind: "ready", tier, backend: tilawa.model.backend, loadMs: Date.now() - t0 });
    return tilawa;
  })();
  entry.promise.catch((e: unknown) => {
    if (current === entry) current = null;
    setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
  });
  current = entry;
  return entry.promise;
}
