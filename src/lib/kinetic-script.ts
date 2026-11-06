import type { PhotoKey } from '@/lib/scene-assets'

/*
 * The kinetic-type score: the narration split into full-screen "cards".
 * A card hard-cuts in just before its first word; each chunk inside it
 * enters on its own first word with one of the effects below. The cards
 * are black and cream; the seventies palette is in the words of a few of
 * them (UPHOLSTERED, the colours, DON'T WORRY, HOME) and in the orange tide.
 *
 * Word indices refer to the words of each line in narration.ts.
 */
export type Size = 'crop' | 'xxl' | 'xl' | 'lg' | 'md' | 'sm'

export type Fx =
  | 'slam' // scale punch out of a blur
  | 'stretch' // squashed sliver that snaps wide
  | 'vowel' // stretches in, then keeps stretching while the vowel is held
  | 'type' // typewriter with a caret
  | 'fill' // letters filled with a photograph
  | 'smear' // horizontal motion-blur swipe
  | 'zoom' // flies in from deep space
  | 'crop' // oversized word, cropped by the screen, shaken
  | 'focus' // focus pull from a soft blur
  | 'slit' // vertical slit-scan smear
  | 'outline' // hollow outline that fills in
  | 'glitch' // sliced copies jitter, then lock
  | 'scatter' // letters drift apart ("space")
  | 'rise' // a line rising from a mask
  | 'water' // hollow outline that fills with orange like rising water
  | 'palette' // slams in, then each letter takes a colour of the palette

export type Bg = 'dark' | 'light'

export interface Chunk {
  line: string
  from: number
  to: number
  size: Size
  fx: Fx
  /** photograph for `fill` */
  photo?: PhotoKey
}

export type PhotoMode =
  | 'behind' // full-bleed, blended into the card
  | 'card' // a framed photo the words overlap
  | 'scatter' // many small photos popping around the words
  | 'strip' // a film strip sliding sideways

export interface Card {
  bg: Bg
  chunks: Chunk[]
  /** `full`: the photo in full colour under a shade, not a faint wash */
  photo?: { mode: PhotoMode; keys: PhotoKey[]; full?: boolean }
  /** question marks fly in (ask) */
  glyphs?: boolean
  /** a cursor glides to the photo card and clicks */
  cursor?: boolean
  /** "HA" pops during this chuckle */
  ha?: [number, number]
  /** a big X slashes across at this time */
  slash?: number
  /** how the card leaves */
  exit?: 'blur' | 'zoom' | 'cut'
  /** a row of photos in grey; `out` (in colour) is pushed out of the group */
  group?: { keys: PhotoKey[]; out: PhotoKey }
  /** after the words: an orange tide rises and paints the whole screen */
  flood?: boolean
  /** the words in a colour of the palette (instead of black or cream) */
  ink?: string
}

const c = (line: string, from: number, to: number, size: Size, fx: Fx, photo?: PhotoKey): Chunk => ({
  line,
  from,
  to,
  size,
  fx,
  photo,
})

export const CARDS: Card[] = [
  // "Hellooo…" (a held, playful vowel) and the first chuckle
  { bg: 'dark', chunks: [c('hello', 0, 0, 'xl', 'vowel')], ha: [1.22, 1.7], exit: 'zoom' },
  // "You / finally / found us." stacks up
  {
    bg: 'light',
    chunks: [c('hello', 1, 1, 'lg', 'slam'), c('hello', 2, 2, 'xl', 'slam'), c('hello', 3, 4, 'lg', 'slam')],
  },
  // "Let's make your DREAM KITCHEN happen." (photo inside the letters)
  {
    bg: 'dark',
    chunks: [
      c('kitchen', 0, 2, 'sm', 'type'),
      c('kitchen', 3, 3, 'xxl', 'fill', 'station'),
      c('kitchen', 4, 4, 'xl', 'fill', 'kitchen'),
      c('kitchen', 5, 5, 'md', 'slam'),
    ],
    exit: 'zoom',
  },
  // "Or other FURNITURE, for that matter."
  {
    bg: 'dark',
    photo: { mode: 'behind', keys: ['wardrobe'] },
    chunks: [c('other', 0, 1, 'md', 'smear'), c('other', 2, 2, 'xl', 'zoom'), c('other', 3, 5, 'sm', 'rise')],
    exit: 'zoom',
  },
  // "Just nothing UPHOLSTERED." in mustard over the sofa, then slashed out
  {
    bg: 'light',
    ink: '#dca546',
    photo: { mode: 'behind', keys: ['sofa'] },
    chunks: [c('sofa', 0, 1, 'md', 'slam'), c('sofa', 2, 2, 'lg', 'glitch')],
    slash: 9.12,
    exit: 'cut',
  },
  // "No," "no," "no…" — oversized, inverting, then the second chuckle
  { bg: 'dark', chunks: [c('sofa', 3, 3, 'crop', 'crop')], exit: 'cut' },
  { bg: 'light', chunks: [c('sofa', 4, 4, 'crop', 'crop')], exit: 'cut' },
  { bg: 'dark', chunks: [c('sofa', 5, 5, 'crop', 'crop')], ha: [10.44, 11.05] },
  // "So… what are you / looking for?" with question marks
  {
    bg: 'light',
    glyphs: true,
    chunks: [c('ask', 0, 0, 'md', 'focus'), c('ask', 1, 3, 'md', 'slam'), c('ask', 4, 5, 'lg', 'slam')],
  },
  // "A kitchen?" — a row of our work in grey; the kitchen, the only one in
  // colour, is pushed out of the group
  {
    bg: 'dark',
    group: { keys: ['wardrobe', 'mirror', 'corridor', 'shelves', 'bedroom', 'oakWall', 'sofa'], out: 'shelves' },
    chunks: [c('perhaps', 0, 1, 'xl', 'slam')],
  },
  // "Or perhaps… a different / COLOUR?" — the word fills with orange like
  // rising water, then the tide paints the whole screen
  {
    bg: 'light',
    flood: true,
    chunks: [c('perhaps', 2, 3, 'md', 'focus'), c('perhaps', 4, 5, 'md', 'rise'), c('perhaps', 6, 6, 'xl', 'water')],
  },
  // The colours, each over its own kitchen and written in its own colour
  { bg: 'dark', ink: '#86b394', photo: { mode: 'behind', keys: ['forest'], full: true }, chunks: [c('colours', 0, 1, 'lg', 'stretch')] },
  { bg: 'dark', ink: '#f4ead7', photo: { mode: 'behind', keys: ['white'], full: true }, chunks: [c('colours', 2, 3, 'lg', 'slit')] },
  {
    bg: 'dark',
    ink: '#d3c8b6',
    photo: { mode: 'behind', keys: ['graphite'], full: true },
    chunks: [c('colours', 4, 5, 'md', 'rise'), c('colours', 6, 6, 'xl', 'slam')],
  },
  // "We've got PLENTY to choose from." — photos everywhere
  {
    bg: 'dark',
    photo: { mode: 'scatter', keys: ['kitchen', 'mirror', 'oakWall', 'corridor', 'bedroom', 'wardrobe', 'shelves'] },
    chunks: [c('plenty', 0, 1, 'md', 'rise'), c('plenty', 2, 2, 'xxl', 'slit'), c('plenty', 3, 5, 'md', 'smear')],
  },
  // "Don't worry." — calm, in green
  { bg: 'light', ink: '#3e5848', chunks: [c('plenty', 6, 7, 'lg', 'focus')] },
  // "All right, all right…" typed
  { bg: 'dark', chunks: [c('space', 0, 1, 'lg', 'type'), c('space', 2, 3, 'lg', 'type')] },
  // "I'll give you some SPACE." — the letters drift apart
  { bg: 'light', chunks: [c('space', 4, 7, 'md', 'rise'), c('space', 8, 8, 'xl', 'scatter')] },
  // "Have a look AROUND." over a sliding film strip
  {
    bg: 'dark',
    photo: { mode: 'strip', keys: ['station', 'wardrobe', 'oakWall', 'bedroom', 'shelves', 'corridor', 'kitchen'] },
    chunks: [c('home', 0, 2, 'md', 'smear'), c('home', 3, 3, 'xl', 'slam')],
  },
  // "See what feels like HOME." — and HOME takes the palette, letter by letter
  { bg: 'dark', chunks: [c('home', 4, 7, 'md', 'rise'), c('home', 8, 8, 'xxl', 'palette')] },
]
