/*
 * Kencho photographs (from kenchogroup.ge) used by the loader and the
 * kinetic cards. `ratio` is width / height for the scattered loader layout.
 */
export const PHOTOS = {
  kitchen: { src: '/media/frames/kitchen.webp', ratio: 3 / 2, alt: 'Walnut and white island kitchen' },
  station: { src: '/media/frames/station.webp', ratio: 3 / 2, alt: 'Walnut kitchen with a fluted island' },
  wardrobe: { src: '/media/frames/wardrobe.webp', ratio: 4 / 3, alt: 'Oak-framed wardrobe wall' },
  sofa: { src: '/media/frames/media-wall.webp', ratio: 3 / 2, alt: 'Living room media wall with a sofa' },
  forest: { src: '/media/frames/forest-green.webp', ratio: 3 / 2, alt: 'Forest green kitchen' },
  white: { src: '/media/frames/warm-white.webp', ratio: 3 / 2, alt: 'Warm white kitchen' },
  greige: { src: '/media/frames/greige.webp', ratio: 3 / 2, alt: 'Greige kitchen' },
  mirror: { src: '/media/frames/mirror.webp', ratio: 1 / 1.9, alt: 'Bronze mirror wardrobe' },
  shelves: { src: '/media/frames/shelves.webp', ratio: 3 / 2, alt: 'Oak island kitchen with shelving' },
  oakWall: { src: '/media/frames/oak-wall.webp', ratio: 3 / 2, alt: 'Oak kitchen wall' },
  corridor: { src: '/media/frames/corridor.webp', ratio: 3 / 2, alt: 'Walnut panelled corridor' },
  bedroom: { src: '/media/frames/bedroom.webp', ratio: 4 / 3, alt: 'Walnut panelled bedroom' },
  graphite: { src: '/media/photos/oak-graphite.webp', ratio: 926 / 616, alt: 'Graphite kitchen under oak wall cabinets' },
} as const

export type PhotoKey = keyof typeof PHOTOS

export const PHOTO_KEYS = Object.keys(PHOTOS) as PhotoKey[]
