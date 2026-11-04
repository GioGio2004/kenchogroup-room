/*
 * What a visitor has done in the room, kept in their own browser
 * (localStorage) and never sent anywhere. The room reads it to skip the
 * intro on a reload, to greet a returning visitor, and to let the narrator
 * react; the menu shows it, with a way to forget it all.
 */
export type IntroPath = 'classic' | 'sketch'
export type Tally = Record<string, number>

export interface Track {
  version: 1
  firstSeen: number
  lastSeen: number
  /** visits: a new one starts after half an hour away */
  visits: number
  /** milliseconds spent in the room, all visits together */
  timeSpent: number
  /** the opening they chose, and whether they have been through it */
  path: IntroPath | null
  introSeen: boolean
  /** the narrator on or off, as they last left it */
  voice: boolean | null
  views: Tally
  angles: Tally
  finishes: Tally
  lastFinish: string | null
  photos: Tally
  links: Tally
}

const KEY = 'kencho-room-tracker'
const NEW_VISIT_MS = 30 * 60 * 1000

const fresh = (): Track => ({
  version: 1,
  firstSeen: Date.now(),
  lastSeen: 0,
  visits: 0,
  timeSpent: 0,
  path: null,
  introSeen: false,
  voice: null,
  views: {},
  angles: {},
  finishes: {},
  lastFinish: null,
  photos: {},
  links: {},
})

function read(): Track {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Track> | null
    return saved?.version === 1 ? { ...fresh(), ...saved } : fresh()
  } catch {
    return fresh()
  }
}

class Tracker {
  private data = read()
  /** a return visit (the last one ended over half an hour ago) */
  readonly returning: boolean

  constructor() {
    const now = Date.now()
    this.returning = this.data.visits > 0 && now - this.data.lastSeen > NEW_VISIT_MS
    if (this.data.visits === 0 || this.returning) this.data.visits++
    this.data.lastSeen = now
    this.save()
  }

  get(): Readonly<Track> {
    return this.data
  }

  set(patch: Partial<Track>) {
    this.data = { ...this.data, ...patch, lastSeen: Date.now() }
    this.save()
  }

  /** one more of something: a view entered, an angle, a finish, a photo, a link */
  count(group: 'views' | 'angles' | 'finishes' | 'photos' | 'links', key: string) {
    const tally = { ...this.data[group], [key]: (this.data[group][key] ?? 0) + 1 }
    this.set({ [group]: tally } as Partial<Track>)
  }

  /** time in the room, added in small steps while the tab is visible */
  addTime(ms: number) {
    this.set({ timeSpent: this.data.timeSpent + ms })
  }

  /** the most used key of a tally */
  favourite(group: 'views' | 'angles' | 'finishes') {
    const entries = Object.entries(this.data[group])
    return entries.length ? entries.sort((a, b) => b[1] - a[1])[0][0] : null
  }

  /** forget everything this browser remembers about the visitor */
  forget() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('kencho-room')) localStorage.removeItem(k)
    } catch {
      // storage blocked: nothing was remembered anyway
    }
    this.data = { ...fresh(), visits: 1, lastSeen: Date.now() }
    this.save()
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch {
      // private mode or storage full: the room still works, it just forgets
    }
  }
}

export const tracker = new Tracker()
