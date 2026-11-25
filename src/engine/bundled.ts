/**
 * Loads the Tilawa listener model and the Quran reference from assets bundled in the APK. Nothing is downloaded.
 *
 * The .onnx ships as an Expo asset. On first launch it is copied once into the app's document directory, and
 * onnxruntime-react-native opens it by file path, so the 25–68 MB model never crosses the JS bridge as bytes.
 */
import { Asset } from "expo-asset";
import * as Device from "expo-device";
import { Directory, File, Paths } from "expo-file-system";
import * as ort from "onnxruntime-react-native";
import { MODEL_REGISTRY, ortBackend, setPrecomputedIndexes } from "@tilawa/core";
import type { LoadedModel, OrtModule, ReferenceAsset, TierName } from "@tilawa/core";

/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles assets through require() */
const MODEL_MODULES: Record<TierName, number> = {
  lite: require("../../assets/tilawa/lite.onnx"),
  full: require("../../assets/tilawa/full.onnx"),
};
const REFERENCE_MODULE: number = require("../../assets/tilawa/ref-v2.txt");
const TABLES_MODULE: number = require("../../assets/tilawa/engine-tables.txt");
/* eslint-enable @typescript-eslint/no-require-imports */

export type TierChoice = TierName | "auto";

/** `full` on phones with at least 6 GB of RAM, `lite` otherwise (upstream's React Native default is always `lite`). */
export function resolveTier(choice: TierChoice): TierName {
  if (choice !== "auto") return choice;
  const total = Device.totalMemory ?? 0;
  return total >= 6 * 1024 ** 3 ? "full" : "lite";
}

function tierEntry(tier: TierName) {
  const t = MODEL_REGISTRY.tiers.find((x) => x.tier === tier);
  if (!t) throw new Error(`No ${tier} tier in the Tilawa model registry`);
  return t;
}

/** Copies a bundled asset to `documents/<dir>/<name>` once; later launches reuse the copy when its size matches. */
async function materialize(module: number, dir: string, name: string, bytes?: number): Promise<File> {
  const folder = new Directory(Paths.document, dir);
  folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, name);
  if (target.exists && (bytes === undefined || target.size === bytes)) return target;
  if (target.exists) target.delete();

  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error(`Bundled asset ${name} has no local file`);
  const source = new File(asset.localUri);
  await source.copy(target);
  if (bytes !== undefined && target.size !== bytes) {
    target.delete();
    throw new Error(`Bundled ${name} is ${target.size} bytes, expected ${bytes}`);
  }
  return target;
}

const toPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ""));

export interface BundledModel {
  model: LoadedModel;
  tier: TierName;
}

export async function loadBundledModel(choice: TierChoice, threads = 2): Promise<BundledModel> {
  const tier = resolveTier(choice);
  const entry = tierEntry(tier);
  const file = await materialize(MODEL_MODULES[tier], "models", `${entry.id}@${entry.version}.onnx`, entry.bytes);
  const backend = await ortBackend(ort as unknown as OrtModule, toPath(file.uri), "onnxruntime-react-native", {
    executionProviders: ["cpu"],
    intraOpNumThreads: threads,
  });
  return { tier, model: { manifest: entry.manifest, backend, supported: entry.supported } };
}

let referencePromise: Promise<ReferenceAsset> | null = null;

export function loadBundledReference(): Promise<ReferenceAsset> {
  referencePromise ??= (async () => {
    const file = await materialize(REFERENCE_MODULE, "reference", "ref-v2.json");
    return JSON.parse(await file.text()) as ReferenceAsset;
  })();
  return referencePromise;
}

let tablesPromise: Promise<void> | null = null;

/**
 * Registers the checker's index tables, precomputed at build time (`npm run precompute`), so the engine doesn't
 * spend seconds building them on the phone. If the file is missing or doesn't match, the engine builds its own.
 */
export function loadBundledEngineTables(): Promise<void> {
  tablesPromise ??= (async () => {
    try {
      const file = await materialize(TABLES_MODULE, "reference", "engine-tables-v2.json");
      setPrecomputedIndexes(JSON.parse(await file.text()));
    } catch {
      setPrecomputedIndexes(null);
    }
  })();
  return tablesPromise;
}
