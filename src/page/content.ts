/*
 * Every word and fact on the page. Contact details come from the main site
 * (kencho-group/lib/site.ts); the photographs are real Kencho projects from
 * kenchogroup.ge (public/media/photos). Nothing here is invented.
 */
import { KITCHEN_THEMES } from '@/scenes/room/themes'

export const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://www.kenchogroup.ge'

export const CONTACT = {
  phone: '+995 592 82 22 60',
  tel: 'tel:+995592822260',
  whatsapp: 'https://wa.me/995592822260',
  email: 'kenchogroup@gmail.com',
  address: 'Guram Panjikidze St 1',
  city: 'Tbilisi, Georgia',
  map: 'https://maps.google.com/?q=41.7225,44.7754',
  hours: [
    ['Mon – Fri', '10:00 – 19:00'],
    ['Saturday', '11:00 – 17:00'],
    ['Sunday', 'Closed'],
  ] as Array<[string, string]>,
  facebook: 'https://www.facebook.com/kenchogroup',
  tiktok: 'https://www.tiktok.com/@kencho.group',
}

export const LINKS = {
  gallery: `${MAIN}/en/gallery`,
  about: `${MAIN}/en/about`,
  contact: `${MAIN}/en/contact`,
}

/* The real projects, by file name in public/media/photos. */
export const PHOTO = {
  'green-island': { w: 1600, h: 1066, alt: 'A green kitchen with a long island and white stools' },
  'walnut-island': { w: 1600, h: 1066, alt: 'A white and walnut kitchen with an island and pendant lights' },
  'oak-graphite': { w: 926, h: 616, alt: 'An L-shaped graphite kitchen with oak wall cabinets' },
  'white-oak': { w: 1600, h: 1066, alt: 'A white kitchen run under oak wall cabinets' },
  'dark-walnut': { w: 1544, h: 1047, alt: 'A dark walnut kitchen with a black island' },
  'grey-kitchen': { w: 1600, h: 1067, alt: 'A greige L-shaped kitchen with a dining table' },
  'green-marble': { w: 1600, h: 1171, alt: 'A green kitchen with a marble island and oak shelves' },
  'walnut-upper': { w: 1600, h: 1067, alt: 'Walnut wall cabinets over a white kitchen' },
  'classic-white': { w: 1600, h: 1118, alt: 'A classic white kitchen with glazed cabinets' },
  'oak-wardrobe': { w: 1600, h: 1160, alt: 'Oak-framed wardrobes with pale panels along a hall' },
  'teal-bedroom': { w: 1450, h: 823, alt: 'A white built-in wardrobe in a teal bedroom' },
  'walnut-bedroom': { w: 1600, h: 1200, alt: 'A bedroom with walnut panelling and a green wall' },
  'bronze-mirror': { w: 832, h: 1600, alt: 'A wardrobe with bronze mirrored doors' },
  'cane-wardrobe': { w: 1066, h: 1600, alt: 'An entryway wardrobe with cane panels and shoe shelves' },
  'media-wall': { w: 1600, h: 1068, alt: 'A white media wall with a television above a low console' },
  'open-plan': { w: 1600, h: 1066, alt: 'An open-plan room with a walnut media unit and a kitchen behind' },
  'slat-wall': { w: 1600, h: 1067, alt: 'A backlit oak slat wall with a round mirror' },
  'arched-shelves': { w: 1066, h: 1600, alt: 'Arched oak shelving with warm lighting' },
  'oak-shelves': { w: 1600, h: 1066, alt: 'An oak kitchen with open shelves and an island' },
  'fluted-oak': { w: 1066, h: 1600, alt: 'A fluted oak panel, close up' },
  'kids-room': { w: 1600, h: 1200, alt: 'A green kids room with a climbing wall and a bunk' },
  'fit-out': { w: 1600, h: 1066, alt: 'An office fit-out in progress, walnut panels going up' },
  'walnut-wall': { w: 1600, h: 1066, alt: 'A floor-to-ceiling walnut wall unit in an office' },
} as const
export type PhotoKey = keyof typeof PHOTO
export const photo = (k: PhotoKey) => `/media/photos/${k}.webp`

/* The retro palette: a seventies interior, on cream paper. */
export const C = {
  paper: '#f4efe4',
  cream: '#efe5d3',
  ink: '#1f1c18',
  terra: '#c5603d',
  mustard: '#dca443',
  orange: '#e3803c',
  sage: '#8e9b85',
  forest: '#3e5848',
  teal: '#5f8a84',
  rose: '#e7ab9a',
} as const

export const NAV = [
  { id: 'pieces', label: 'What we make' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'room', label: 'The room' },
] as const


/* (02) What we make. Each piece is a colour, a shape and a photograph. */
export type Shape = 'arch' | 'circle' | 'pill' | 'flower' | 'tab' | 'round'
export const PIECES: Array<{ n: string; title: string; text: string; photo: PhotoKey; bg: string; fg: string; shape: Shape }> = [
  { n: '01', title: 'Kitchens', text: 'Islands, long runs, tall walls of storage. Every door cut for your room.', photo: 'green-island', bg: C.terra, fg: C.paper, shape: 'arch' },
  { n: '02', title: 'Wardrobes', text: 'Floor to ceiling, mirrored, caned or plain. Built into the wall, not stood against it.', photo: 'oak-wardrobe', bg: C.mustard, fg: C.ink, shape: 'circle' },
  { n: '03', title: 'Media walls', text: 'One clean wall for the TV, the speakers and all those cables.', photo: 'media-wall', bg: C.sage, fg: C.ink, shape: 'pill' },
  { n: '04', title: 'Shelving', text: 'Arched, fluted, lit from inside. Shelves that are part of the house.', photo: 'arched-shelves', bg: C.forest, fg: C.paper, shape: 'tab' },
  { n: '05', title: 'Bedrooms & kids rooms', text: 'Panelled walls, beds with storage, a climbing wall if you ask nicely.', photo: 'kids-room', bg: C.rose, fg: C.ink, shape: 'flower' },
  { n: '06', title: 'Offices', text: 'Walnut walls and fitted storage for offices, built around the working day.', photo: 'walnut-wall', bg: C.teal, fg: C.paper, shape: 'round' },
]

/* (03) Finishes: the same five as the room's kitchen, so a pick carries down. */
export const FINISHES = KITCHEN_THEMES
export const FINISH_KEY = 'kencho-room-finish-sketch'
export const FINISH_EVENT = 'kencho:finish'
