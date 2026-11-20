// Mic recordings are saved as WAV: MediaRecorder's WebM has no duration in its header, which both probes need.

/** Mono 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
  return buf
}

/** Decode whatever MediaRecorder produced and re-encode it as mono WAV. */
export async function recordingToWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext()
  try {
    const a = await ctx.decodeAudioData(await blob.arrayBuffer())
    const mono = new Float32Array(a.length)
    for (let c = 0; c < a.numberOfChannels; c++) {
      const d = a.getChannelData(c)
      for (let i = 0; i < d.length; i++) mono[i] += d[i] / a.numberOfChannels
    }
    return encodeWav(mono, a.sampleRate)
  } finally {
    void ctx.close()
  }
}
