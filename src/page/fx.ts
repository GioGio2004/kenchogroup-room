/*
 * GSAP for the page: every plugin it uses, registered once, plus small
 * helpers shared by the sections.
 */
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from '@/lib/motion'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase)

/* The brand never snaps: long glides, and a soft overshoot for things that land. */
CustomEase.create('glide', '0.65,0,0.35,1')
CustomEase.create('land', 'M0,0 C0.18,0.9 0.32,1.08 0.5,1.04 0.7,1 0.84,1 1,1')

export const reduced = () => prefersReducedMotion()
export const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches
export const phone = () => window.innerWidth < 760 || window.innerWidth / window.innerHeight < 0.8

/* Smoothed scroll velocity (px/s), for things that lean or speed up with the scroll. */
export const velocity = { v: 0 }
let lastY = 0
let lastT = 0
gsap.ticker.add((time) => {
  const y = window.scrollY
  const dt = time - lastT
  if (dt > 0) {
    const raw = (y - lastY) / dt
    velocity.v += (raw - velocity.v) * 0.12
  }
  lastY = y
  lastT = time
})

/* Scroll to a section (the room footer: the very bottom). */
export { goTo as scrollToId } from '@/nav/Navbar'

export { gsap, ScrollTrigger, useGSAP, SplitText }
