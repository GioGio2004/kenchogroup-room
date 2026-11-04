import { gsap } from '@/lib/motion'

/*
 * The room's narrator: short voice lines played on what the visitor does.
 * Voice only (nothing on screen). Rules:
 *  - one line at a time; only a click-level line (priority 3) cuts in, with a
 *    short fade; anything quieter waits its turn or is dropped
 *  - each line once per visit; each visit picks a take not heard before
 *  - muted means silent: nothing plays, a playing line stops
 * The takes and sound effects come from public/media/audio/room/manifest.json
 * (written by `npm run voice`); if it is missing, the room just stays quiet.
 */
type Take = { src: string; sfx?: string; at?: number }
interface Manifest {
  lines: Record<string, Take[]>
  sfx: Record<string, string>
}
export type Priority = 1 | 2 | 3

const MANIFEST = '/media/audio/room/manifest.json'
const HEARD_KEY = 'kencho-room-heard'
const SFX_VOLUME = 0.5

function readHeard(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HEARD_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

class Narrator {
  private muted = true
  private manifest: Promise<Manifest | null> | null = null
  private current: { el: HTMLAudioElement; priority: Priority; finish: () => void } | null = null
  private timers: number[] = []
  private lastEnd = 0
  private said = new Set<string>()
  private primed = new Map<string, { take: Take; el: HTMLAudioElement }>()
  private heard = readHeard()

  private load() {
    this.manifest ??= fetch(MANIFEST)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null)
    return this.manifest
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) this.stop()
    else void this.load()
  }

  /** has this line already played this visit? */
  hasSaid(id: string) {
    return this.said.has(id)
  }

  /** milliseconds of silence since the last line ended (0 while one plays) */
  quietFor() {
    return this.current ? 0 : performance.now() - this.lastEnd
  }

  /* A take nobody has heard on this device yet; otherwise any but the last. */
  private pick(takes: Take[]) {
    const fresh = takes.filter((t) => !this.heard.includes(t.src))
    const pool = fresh.length ? fresh : takes.filter((t) => t.src !== this.heard.at(-1))
    return (pool.length ? pool : takes)[Math.floor(Math.random() * (pool.length || takes.length))]
  }

  private remember(src: string) {
    this.heard = [...this.heard.filter((s) => s !== src), src].slice(-400)
    try {
      localStorage.setItem(HEARD_KEY, JSON.stringify(this.heard))
    } catch {
      // private mode: takes may repeat next visit
    }
  }

  /** load the takes that are likely next, so they start without a gap */
  async prime(ids: string[]) {
    const m = await this.load()
    if (!m || this.muted) return
    for (const id of ids) {
      if (this.primed.has(id) || this.said.has(id) || !m.lines[id]?.length) continue
      const take = this.pick(m.lines[id])
      const el = new Audio(take.src)
      el.preload = 'auto'
      this.primed.set(id, { take, el })
    }
  }

  /**
   * Play a line. Resolves when it ends (or at once if it can't play), so a
   * redirect can wait for it.
   */
  async say(id: string, { priority = 2, once = true }: { priority?: Priority; once?: boolean } = {}): Promise<void> {
    if (this.muted || (once && this.said.has(id))) return
    if (this.current && priority < 3) return
    const m = await this.load()
    if (!m || this.muted || !m.lines[id]?.length) return
    // another line may have started while the manifest loaded
    if (this.current && (priority < 3 || this.current.priority > priority)) return
    this.stop(0.18)
    this.said.add(id)

    const ready = this.primed.get(id)
    this.primed.delete(id)
    const take = ready?.take ?? this.pick(m.lines[id])
    const el = ready?.el ?? new Audio(take.src)
    this.remember(take.src)

    return new Promise<void>((resolve) => {
      const finish = () => {
        if (this.current?.el === el) {
          this.current = null
          this.lastEnd = performance.now()
        }
        el.onended = el.onerror = null
        resolve()
      }
      el.onended = finish
      el.onerror = finish
      el.volume = 1
      this.current = { el, priority, finish }
      el.play().catch(finish)
      if (take.sfx) this.timers.push(window.setTimeout(() => this.sfx(take.sfx!), (take.at ?? 0) * 1000))
    })
  }

  /** a sound effect on its own (it never blocks a line) */
  async sfx(name: string) {
    if (this.muted) return
    const src = (await this.load())?.sfx[name]
    if (!src || this.muted) return
    const el = new Audio(src)
    el.volume = SFX_VOLUME
    void el.play().catch(() => {})
  }

  /** resolves when the current line has finished, or after `max` ms */
  whenQuiet(max: number) {
    const now = this.current
    if (!now) return Promise.resolve()
    return Promise.race([
      new Promise<void>((resolve) => now.el.addEventListener('ended', () => resolve(), { once: true })),
      new Promise<void>((resolve) => setTimeout(resolve, max)),
    ])
  }

  /** stop whatever is playing (with a short fade) */
  stop(fade = 0.2) {
    this.timers.forEach((t) => clearTimeout(t))
    this.timers = []
    const now = this.current
    if (!now) return
    this.current = null
    this.lastEnd = performance.now()
    gsap.to(now.el, { volume: 0, duration: fade, ease: 'power1.out', onComplete: () => now.el.pause() })
    now.finish()
  }
}

export const narrator = new Narrator()
