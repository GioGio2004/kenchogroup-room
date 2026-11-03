# kenchogroup-room — room.kenchogroup.ge

The experimental, awwwards-targeted experience for Kencho Group (custom
furniture, Tbilisi). Everything new and risky lives here; the main site
(`kencho-group`, Next.js) keeps only finished features, and the admin CMS is
`kenchogroup-admin`. Real links (gallery, about, contact) go to
`VITE_MAIN_SITE_URL`.

## Stack
Vite + React 19 + TypeScript, three.js via React Three Fiber (+ drei), GSAP
(ScrollTrigger, `@gsap/react`), Lenis. npm. Static output (`dist/`), hosted on
Vercel. Lint: `npm run lint` (oxlint). Build: `npm run build`.

## Concept
"The apartment is the webpage": a hyperrealistic room as the interface,
opened by a narrator (see `docs/narration.md`). Rooms are Higgsfield video
"stations" chained by matching last/first frames; cabinet fronts recolour live
via a WebGL shader + mask on a photoreal still.

## Rules
- Phones first (~80% of traffic). Every heavy asset needs a phone budget.
- Motion glides, never snaps: long inOut/out eases (`--ease-glide`).
- `prefers-reduced-motion` → fades only.
- Audio needs a user gesture; always offer sound-off with captions.
- Media lives in `public/media/{video,frames,audio}`. No secrets in `VITE_*`.
- Lenis is the one scroller (`src/lib/motion.ts`).
