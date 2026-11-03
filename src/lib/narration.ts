/*
 * The opening narration, word by word, in seconds. Word times come from a
 * Whisper transcription of the recording, cross-checked against the audio's
 * speech onsets (2026-11-04). If the voice is re-recorded, re-run the
 * alignment or tune by ear with `?calibrate` (Space at each line start).
 * Every visual beat is keyed to these words.
 */
export const NARRATION = {
  src: '/media/audio/narrator-en.mp3',
  duration: 30.2,
}

export interface Word {
  text: string
  start: number
  end: number
}

export interface Line {
  id: string
  words: Word[]
  text: string
  start: number
  end: number
}

type Raw = [text: string, start: number, end: number]

const RAW: Array<[id: string, words: Raw[]]> = [
  ['hello', [['Hellooo…', 0.15, 1.2], ['You', 1.74, 2.18], ['finally', 2.18, 2.56], ['found', 2.56, 2.96], ['us.', 2.96, 3.32]]],
  ['kitchen', [["Let's", 3.83, 4.06], ['make', 4.06, 4.24], ['your', 4.24, 4.46], ['dream', 4.46, 4.78], ['kitchen', 4.78, 5.18], ['happen.', 5.18, 5.62]]],
  ['other', [['Or', 5.98, 6.18], ['other', 6.18, 6.52], ['furniture,', 6.52, 6.88], ['for', 7.0, 7.1], ['that', 7.1, 7.26], ['matter.', 7.26, 7.56]]],
  ['sofa', [['Just', 7.96, 8.18], ['nothing', 8.18, 8.64], ['upholstered.', 8.64, 9.26], ['No,', 9.6, 9.76], ['no,', 9.8, 9.92], ['no…', 9.92, 10.4]]],
  ['ask', [['So…', 11.14, 11.6], ['what', 12.06, 12.18], ['are', 12.18, 12.28], ['you', 12.28, 12.38], ['looking', 12.38, 12.56], ['for?', 12.56, 12.92]]],
  ['perhaps', [['A', 13.4, 13.52], ['kitchen?', 13.52, 13.82], ['Or', 14.38, 14.58], ['perhaps…', 14.58, 15.3], ['a', 15.44, 15.52], ['different', 15.52, 15.8], ['colour?', 15.8, 16.1]]],
  ['colours', [['Forest', 16.95, 17.3], ['green…', 17.3, 18.1], ['warm', 18.18, 18.46], ['white…', 18.46, 19.3], ['a', 19.47, 19.54], ['little', 19.54, 19.74], ['greige?', 19.74, 20.6]]],
  ['plenty', [["We've", 20.97, 21.14], ['got', 21.14, 21.28], ['plenty', 21.28, 21.46], ['to', 21.46, 21.72], ['choose', 21.72, 21.92], ['from.', 21.92, 22.2], ["Don't", 22.57, 22.78], ['worry.', 22.78, 23.0]]],
  ['space', [['All', 24.08, 24.32], ['right,', 24.32, 24.6], ['all', 24.68, 24.84], ['right…', 24.84, 25.14], ["I'll", 25.46, 25.68], ['give', 25.68, 25.82], ['you', 25.82, 25.98], ['some', 25.98, 26.14], ['space.', 26.14, 26.48]]],
  ['home', [['Have', 27.11, 27.22], ['a', 27.22, 27.36], ['look', 27.36, 27.44], ['around.', 27.44, 27.74], ['See', 28.31, 28.48], ['what', 28.48, 28.68], ['feels', 28.68, 29.08], ['like', 29.08, 29.48], ['home.', 29.48, 29.8]]],
]

export const LINES: Line[] = RAW.map(([id, raw]) => {
  const words = raw.map(([text, start, end]) => ({ text, start, end }))
  return {
    id,
    words,
    text: words.map((w) => w.text).join(' '),
    start: words[0].start,
    end: words[words.length - 1].end,
  }
})

/* The two chuckles in the recording ("HA" pops land here). */
export const CHUCKLES: Array<[start: number, end: number]> = [
  [1.22, 1.7],
  [10.44, 11.05],
]

export const wordsOf = (l: Line): Word[] => l.words

export const line = (id: string): Line => {
  const found = LINES.find((l) => l.id === id)
  if (!found) throw new Error(`Unknown narration line: ${id}`)
  return found
}

/* When a given word is spoken (first word starting with `prefix`). */
export function cue(id: string, prefix: string): number {
  const l = line(id)
  return l.words.find((w) => w.text.toLowerCase().startsWith(prefix))?.start ?? l.start
}
