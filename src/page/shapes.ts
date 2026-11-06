/*
 * A retro daisy as SVG path data in a 200 × 200 box centred on (100, 100),
 * used (scaled to the unit box) as the flower-shaped photo mask.
 */
const f = (n: number) => n.toFixed(2)
const pt = (r: number, a: number) => `${f(100 + r * Math.cos(a))} ${f(100 + r * Math.sin(a))}`

/** n round petals between radius r0 (the waist) and r1 (the tips) */
export function daisy(n = 8, r0 = 46, r1 = 96) {
  const step = (Math.PI * 2) / n
  let d = `M${pt(r0, -Math.PI / 2 - step / 2)}`
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step
    // two controls flung past the tip make a round petal
    d += ` C${pt(r1 * 1.28, a - step * 0.42)} ${pt(r1 * 1.28, a + step * 0.42)} ${pt(r0, a + step / 2)}`
  }
  return d + 'Z'
}

export const SHAPES = { flower: daisy(6, 52, 94) }
