import { useEffect, useRef, useState } from 'react'
import { gsap, fine, reduced } from '@/page/fx'

/*
 * Desktop only: an ink dot with a ring that trails it and opens a little
 * over anything you can click. Over the room it gets out of the way, so the
 * room's own cursor shows.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const [on] = useState(() => typeof window !== 'undefined' && fine() && !reduced())

  useEffect(() => {
    if (!on) return
    const html = document.documentElement
    html.dataset.cursor = ''
    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.12, ease: 'power3.out' })
    const dy = gsap.quickTo(dot.current, 'y', { duration: 0.12, ease: 'power3.out' })
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.5, ease: 'power3.out' })
    const ry = gsap.quickTo(ring.current, 'y', { duration: 0.5, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      html.setAttribute('data-cursor-moved', '')
      dx(e.clientX)
      dy(e.clientY)
      rx(e.clientX)
      ry(e.clientY)
      const t = e.target instanceof Element ? e.target : null
      ring.current?.toggleAttribute('data-link', !!t?.closest('a, button, [role="radio"]'))
      html.toggleAttribute('data-cursor-room', !!t?.closest('.rf-lift'))
    }
    const leave = () => html.setAttribute('data-cursor-out', '')
    const enter = () => html.removeAttribute('data-cursor-out')
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    document.addEventListener('pointerenter', enter)
    return () => {
      delete html.dataset.cursor
      html.removeAttribute('data-cursor-moved')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      document.removeEventListener('pointerenter', enter)
    }
  }, [on])

  if (!on) return null
  return (
    <>
      <div ref={ring} className="cur-ring" aria-hidden="true" />
      <div ref={dot} className="cur-dot" aria-hidden="true" />
    </>
  )
}
