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

On branch `claude/mono` (forked from `main`) there is one opening: the narrated
kinetic one, black and cream (`#f3eee3`), with an orange (`#c5603d`) Start
button on the intro. After it comes a retro one-pager (`src/page`, see
`docs/page.md`) with production's navbar. The hand-drawn room is the footer:
the whole page lifts off it like a lid.

## Rules
- Phones first (~80% of traffic). Every heavy asset needs a phone budget.
- Motion glides, never snaps: long inOut/out eases (`--ease-glide`).
- `prefers-reduced-motion` → fades only.
- iOS Safari kills tabs over their layer memory (3x screens: w·h·9·4 bytes per
  layer). Never `scale` an oversized element to cover the screen; clip a
  screen-sized one. Check with `npm run perf:mem` (`docs/page.md`).
- Audio needs a user gesture; always offer sound-off with captions.
- Media lives in `public/media/{video,frames,audio}`. No secrets in `VITE_*`.
- Lenis is the one scroller (`src/lib/motion.ts`).
