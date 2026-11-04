#!/usr/bin/env node
/*
 * Generates the room narrator's lines and sound effects with ElevenLabs.
 *
 *   npm run voice                      every missing take, then manifest.json
 *   npm run voice -- --only kitchen-first,gallery-first
 *   npm run voice -- --force           regenerate even if the file exists
 *   npm run voice -- --dry             list what would be made, and the characters
 *
 * The key comes from .env.local (ELEVENLABS_API_KEY, loaded by `node
 * --env-file`); it never goes in code. The voice is `voiceId` in
 * scripts/room-voice.json, or --voice <id>, or KENCHO_VOICE_ID.
 */
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const OUT = 'public/media/audio/room'
const PUBLIC = '/media/audio/room'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const script = JSON.parse(await readFile('scripts/room-voice.json', 'utf8'))
const voiceId = value('voice') ?? process.env.KENCHO_VOICE_ID ?? script.voiceId
const only = value('only')?.split(',').map((s) => s.trim())
const dry = flag('dry')
const force = flag('force')

const takes = Object.entries(script.lines).flatMap(([id, list]) =>
  list.map((take, i) => ({ id, n: i + 1, ...(typeof take === 'string' ? { text: take } : take) })),
)
const wanted = takes.filter((t) => !only || only.includes(t.id))
const fileOf = (t) => `${t.id}-${t.n}.mp3`
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  )

const chars = wanted.reduce((sum, t) => sum + t.text.length, 0)
console.log(`${wanted.length} takes, ${chars} characters${only ? ` (only ${only.join(', ')})` : ''}`)
if (dry) {
  for (const t of wanted) console.log(`  ${fileOf(t).padEnd(26)} ${t.text}`)
  process.exit(0)
}
if (!voiceId) {
  console.error('No voice: set "voiceId" in scripts/room-voice.json (or pass --voice <id>).')
  process.exit(1)
}
if (!process.env.ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY is missing: run through `npm run voice`, which loads .env.local.')
  process.exit(1)
}

const client = new ElevenLabsClient()
await mkdir(OUT, { recursive: true })

async function save(stream, path) {
  const source = typeof stream.pipe === 'function' ? stream : Readable.fromWeb(stream)
  await pipeline(source, createWriteStream(path))
}

// Rate limits: retry a few times with a growing pause.
async function withRetry(label, run) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (e) {
      const status = e?.statusCode ?? e?.status
      if (attempt >= 4 || (status && status !== 429 && status < 500)) {
        console.error(`  ✗ ${label}: ${status ?? ''} ${e?.body?.detail?.message ?? e?.message ?? e}`)
        return false
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

let made = 0
let failed = 0
// two at a time, gentle on the account's concurrency limit
const queue = [...wanted]
async function worker() {
  for (let t = queue.shift(); t; t = queue.shift()) {
    const path = `${OUT}/${fileOf(t)}`
    if (!force && (await exists(path))) continue
    const ok = await withRetry(fileOf(t), async () => {
      const audio = await client.textToSpeech.convert(voiceId, {
        text: t.text,
        modelId: script.model,
        voiceSettings: script.voiceSettings,
        outputFormat: 'mp3_44100_128',
      })
      await save(audio, path)
      return true
    })
    if (ok) {
      made++
      console.log(`  ✓ ${fileOf(t)}`)
    } else failed++
  }
}
await Promise.all([worker(), worker()])

// Sound effects, made once.
for (const [name, fx] of Object.entries(script.sfx)) {
  const path = `${OUT}/sfx-${name}.mp3`
  if (only && !only.includes(`sfx-${name}`) && !wanted.some((t) => t.sfx === name)) continue
  if (!force && (await exists(path))) continue
  const ok = await withRetry(`sfx-${name}`, async () => {
    const audio = await client.textToSoundEffects.convert({
      text: fx.text,
      durationSeconds: fx.duration,
      promptInfluence: fx.promptInfluence,
    })
    await save(audio, path)
    return true
  })
  console.log(ok ? `  ✓ sfx-${name}.mp3` : `  ✗ sfx-${name}.mp3`)
}

// The manifest lists only what exists, so the room never asks for a missing file.
const manifest = { lines: {}, sfx: {} }
for (const t of takes) {
  if (!(await exists(`${OUT}/${fileOf(t)}`))) continue
  ;(manifest.lines[t.id] ??= []).push({ src: `${PUBLIC}/${fileOf(t)}`, ...(t.sfx ? { sfx: t.sfx, at: t.at ?? 0 } : {}) })
}
for (const name of Object.keys(script.sfx)) {
  if (await exists(`${OUT}/sfx-${name}.mp3`)) manifest.sfx[name] = `${PUBLIC}/sfx-${name}.mp3`
}
await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Done: ${made} new, ${failed} failed. manifest.json lists ${Object.keys(manifest.lines).length} lines.`)
