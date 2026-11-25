/**
 * Ayah-by-ayah recitation audio. Each ayah is downloaded from everyayah.com the first time it is played and kept in
 * the app's documents folder, so a passage you've listened to once plays offline afterwards.
 */
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";

export type ReciterId = "husary_muallim" | "alafasy" | "minshawi_muallim";

export interface Reciter {
  id: ReciterId;
  ar: string;
  en: string;
  /** Folder name on everyayah.com. */
  folder: string;
}

export const RECITERS: Reciter[] = [
  { id: "husary_muallim", ar: "الحصري (المعلّم)", en: "Al-Husary (teaching)", folder: "Husary_Muallim_128kbps" },
  { id: "alafasy", ar: "مشاري العفاسي", en: "Mishary Alafasy", folder: "Alafasy_64kbps" },
  { id: "minshawi_muallim", ar: "المنشاوي (المعلّم)", en: "Al-Minshawi (teaching)", folder: "Minshawy_Teacher_128kbps" },
];

export const reciter = (id: ReciterId) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

const pad = (n: number) => String(n).padStart(3, "0");
const fileName = (s: number, a: number) => `${pad(s)}${pad(a)}.mp3`;
const ayahUrl = (r: Reciter, s: number, a: number) => `https://everyayah.com/data/${r.folder}/${fileName(s, a)}`;

function folderFor(r: Reciter): Directory {
  const dir = new Directory(Paths.document, "audio", r.folder);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

const inflight = new Map<string, Promise<File>>();

/** The local file for an ayah, downloading it first if needed. */
export function ayahFile(id: ReciterId, s: number, a: number): Promise<File> {
  const r = reciter(id);
  const key = `${r.folder}/${fileName(s, a)}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = (async () => {
    const dir = folderFor(r);
    const target = new File(dir, fileName(s, a));
    if (target.exists && target.size > 0) return target;
    // Download to a temporary name, then move, so an interrupted download never looks like a finished file.
    const part = new File(dir, `${fileName(s, a)}.part`);
    if (part.exists) part.delete();
    await File.downloadFileAsync(ayahUrl(r, s, a), part, { idempotent: true });
    if (target.exists) target.delete();
    part.move(target);
    return target;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Starts downloading upcoming ayahs in the background; failures are ignored (they're retried on play). */
export function prefetch(id: ReciterId, s: number, ayahs: number[]) {
  for (const a of ayahs) ayahFile(id, s, a).catch(() => {});
}

/** Total size of the downloaded audio, in bytes. */
export function downloadedBytes(): number {
  const root = new Directory(Paths.document, "audio");
  if (!root.exists) return 0;
  let total = 0;
  const walk = (d: Directory) => {
    for (const x of d.list()) {
      if (x instanceof Directory) walk(x);
      else total += x.size ?? 0;
    }
  };
  walk(root);
  return total;
}

export function deleteDownloads() {
  const root = new Directory(Paths.document, "audio");
  if (root.exists) root.delete();
}

let player: AudioPlayer | null = null;
let modeSet = false;

function getPlayer(): AudioPlayer {
  player ??= createAudioPlayer(null);
  return player;
}

/** Stops whatever is playing. */
export function stopAyah() {
  if (!player) return;
  player.pause();
}

/**
 * Plays one ayah to the end. Resolves when it finishes, or early (false) when `signal` aborts.
 * Rejects if the audio can't be downloaded (no connection and not cached yet).
 */
export async function playAyah(id: ReciterId, s: number, a: number, signal?: { aborted: boolean }): Promise<boolean> {
  const file = await ayahFile(id, s, a);
  if (signal?.aborted) return false;
  if (!modeSet) {
    // Keep playing in silent mode, and allow the microphone to open right after.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: "duckOthers" }).catch(() => {});
    modeSet = true;
  }
  const p = getPlayer();
  return new Promise<boolean>((resolve) => {
    let started = false;
    const done = (finished: boolean) => {
      sub.remove();
      clearInterval(watch);
      resolve(finished);
    };
    const sub = p.addListener("playbackStatusUpdate", (st: AudioStatus) => {
      if (st.playing) started = true;
      if (st.didJustFinish) done(true);
    });
    // Abort promptly when asked; also guard against a player that never reports the end.
    const watch = setInterval(() => {
      if (signal?.aborted) {
        p.pause();
        done(false);
      } else if (started && !p.playing && p.duration > 0 && p.currentTime >= p.duration - 0.05) done(true);
    }, 150);
    p.replace({ uri: file.uri });
    p.seekTo(0).catch(() => {});
    p.play();
  });
}
