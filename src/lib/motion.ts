import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/*
 * One scroller for the whole experience: Lenis drives the native scroll,
 * GSAP's ticker drives Lenis, and ScrollTrigger listens to Lenis.
 * Returns a cleanup function.
 */
export function startSmoothScroll(): () => void {
  if (prefersReducedMotion()) return () => {}

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 })
  const tick = (time: number) => lenis.raf(time * 1000)

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  ;(window as Window & { __lenis?: Lenis }).__lenis = lenis

  return () => {
    gsap.ticker.remove(tick)
    lenis.destroy()
    delete (window as Window & { __lenis?: Lenis }).__lenis
  }
}

export { gsap, ScrollTrigger, useGSAP }
