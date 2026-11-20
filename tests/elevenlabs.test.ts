// ElevenLabs client: request shapes and error messages, with fetch stubbed (no network, no credits).
import { afterEach, expect, it, vi } from 'vitest'
import { cloneVoice, detail, speak } from '../src/main/elevenlabs'

afterEach(() => vi.unstubAllGlobals())
const stub = (res: Response) => {
  const f = vi.fn(async (_url: string, _init: RequestInit) => res)
  vi.stubGlobal('fetch', f)
  return f
}

it('reads every error body shape ElevenLabs sends', () => {
  expect(detail('{"detail":{"status":"quota_exceeded","message":"Out of credits"}}')).toBe('Out of credits')
  expect(detail('{"detail":"Voice not found"}')).toBe('Voice not found')
  expect(detail('{"detail":[{"msg":"field required"},{"msg":"too long"}]}')).toBe('field required; too long')
  expect(detail('<html>Bad gateway</html>')).toBe('<html>Bad gateway</html>')
})

it('speak posts text and model with the key header and returns the audio bytes', async () => {
  const f = stub(new Response(new Uint8Array([1, 2, 3])))
  expect(await speak('k', 'abc123', 'Hello')).toEqual(new Uint8Array([1, 2, 3]))
  const [url, init] = f.mock.calls[0]
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=mp3_44100_128')
  expect(init.headers).toMatchObject({ 'xi-api-key': 'k' })
  expect(JSON.parse(init.body as string)).toEqual({ text: 'Hello', model_id: 'eleven_multilingual_v2' })
  await expect(speak('k', '../user', 'x')).rejects.toThrow('Pick a voice') // voice id can't change the URL path
})

it('turns 401 and other failures into plain messages', async () => {
  stub(new Response('{"detail":{"message":"invalid key"}}', { status: 401 }))
  await expect(speak('bad', 'abc', 'x')).rejects.toThrow('ElevenLabs rejected the API key.')
  stub(new Response('{"detail":{"message":"Out of credits"}}', { status: 402 }))
  await expect(cloneVoice('k', 'Me', [{ name: 'a.wav', data: new Uint8Array(4) }])).rejects.toThrow('ElevenLabs: Out of credits')
  vi.stubGlobal('fetch', async () => { throw new TypeError('fetch failed') })
  await expect(speak('k', 'abc', 'x')).rejects.toThrow("Couldn't reach ElevenLabs")
})

it('cloneVoice sends the name and every sample as multipart', async () => {
  const f = stub(Response.json({ voice_id: 'v9', requires_verification: false }))
  expect(await cloneVoice('k', 'Me', [{ name: 'a.wav', data: new Uint8Array(4) }, { name: 'b.wav', data: new Uint8Array(4) }])).toEqual({
    id: 'v9', name: 'Me', requiresVerification: false
  })
  const body = f.mock.calls[0][1].body as FormData
  expect(body.get('name')).toBe('Me')
  expect(body.getAll('files').map((x) => (x as File).name)).toEqual(['a.wav', 'b.wav'])
})
