/** Minimal PCM16 WAV reader (mono or the first channel), for the dev-only simulated recitation. */
export function decodePcm16Wav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");
  let offset = 12;
  let channels = 1;
  let sampleRate = 16000;
  let bits = 16;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === "data") {
      if (bits !== 16) throw new Error(`Only 16-bit PCM is supported, got ${bits}-bit`);
      const frames = Math.floor(size / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) samples[i] = view.getInt16(body + i * 2 * channels, true) / 32768;
      return { samples, sampleRate };
    }
    offset = body + size + (size & 1);
  }
  throw new Error("WAV has no data chunk");
}
