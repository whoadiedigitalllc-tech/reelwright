// ElevenLabs REST calls. They run in the main process so the API key never reaches the renderer.
// Docs: https://elevenlabs.io/docs/api-reference (checked 2026-11-20)
import type { Voice } from '../shared/api'

const base = () => process.env.VE_ELEVENLABS_URL ?? 'https://api.elevenlabs.io' // e2e points this at a fake server
export const MODEL = 'eleven_multilingual_v2'

/** The readable part of an ElevenLabs error body: {detail: string | {message} | [{msg}]}. */
export function detail(body: string): string {
  try {
    const d = JSON.parse(body).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x) => x?.msg ?? JSON.stringify(x)).join('; ')
    return d?.message ?? ''
  } catch {
    return body.slice(0, 200)
  }
}

async function call(key: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) {
  let r: Response
  try {
    r = await fetch(base() + path, { ...init, headers: { 'xi-api-key': key, ...init.headers } })
  } catch {
    throw new Error("Couldn't reach ElevenLabs. Check your internet connection.")
  }
  if (r.ok) return r
  if (r.status === 401) throw new Error('ElevenLabs rejected the API key.')
  throw new Error(`ElevenLabs: ${detail(await r.text()) || `request failed (${r.status})`}`)
}

export async function account(key: string) {
  const u = await (await call(key, '/v1/user')).json()
  return { tier: String(u.subscription?.tier ?? ''), canClone: !!u.subscription?.can_use_instant_voice_cloning }
}

export async function listVoices(key: string): Promise<Voice[]> {
  const j = await (await call(key, '/v2/voices?voice_type=personal&page_size=100&sort=name&sort_direction=asc')).json()
  return (j.voices ?? []).map((v: { voice_id: string; name: string }) => ({ id: v.voice_id, name: v.name }))
}

export async function cloneVoice(key: string, name: string, files: { name: string; data: Uint8Array }[]) {
  const form = new FormData()
  form.append('name', name)
  for (const f of files) form.append('files', new Blob([f.data]), f.name)
  const j = await (await call(key, '/v1/voices/add', { method: 'POST', body: form })).json()
  return { id: String(j.voice_id), name, requiresVerification: !!j.requires_verification }
}

/** MP3 bytes of `text` spoken in `voiceId`. */
export async function speak(key: string, voiceId: string, text: string) {
  if (!/^\w+$/.test(voiceId)) throw new Error('Pick a voice first.')
  const r = await call(key, `/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL })
  })
  return new Uint8Array(await r.arrayBuffer())
}
