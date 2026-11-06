# The page

On branch `claude/mono`, forked from `main` (production).

- **One opening.** The narrated kinetic type from production:
  - the intro is on the page's cream `#f3eee3` with black type, and its Start button is orange `#c5603d`;
  - the opening's cards are black and cream. The seventies palette is in the words of a few beats, not their backgrounds:
    - UPHOLSTERED is mustard, over the sofa;
    - "A kitchen?": a grey row of our work, with the kitchen, the only one in colour, pushed out of the group;
    - "Colour?": orange water rises inside the outline, then an orange tide paints the whole screen;
    - forest green, warm white and greige are each written in their own colour over their own kitchen (greige over the graphite and oak one);
    - DON'T WORRY is green;
    - HOME takes the palette letter by letter.
  - Check single frames with `TIMES='[16.6]' npm run opening:frames`.

  The Sketchbook opening and the black-and-white page were removed
  (2026-11-06).
- **The page** follows, on the same cream (`src/page`). Everything is set in
  Inter, with tight upright headings: no serif and no italics.
- **The navbar** is production's: the KENCHO wordmark, then Gallery and
  Menu. The menu panel has the sections, Book a meeting, the
  narrator switch, Return to intro and the memory line (`src/nav/Navbar.tsx`).
  It stays visible over the footer.
- **The footer is the hand-drawn room**, full screen, with only the navbar
  over it. The whole page lifts off it like a lid.

## Top to bottom

| Section | File | What happens |
|---|---|---|
| Arrival | `Page.tsx` | Coloured rings (screen-sized circle masks) burst out of the opening, then the hero lands. |
| Hero | `Hero.tsx` | Three lines of Inter land letter by letter beside a real kitchen in a plain arch. Book a meeting goes to kenchogroup.ge. |
| (01) What we do | `Manifesto.tsx` | One centred sentence. The screen holds while it lights up word by word. |
| (02) What we make | `Pieces.tsx` | The section pins and six coloured cards slide past sideways, each with its own photo shape. |
| (03) Palettes | `Finishes.tsx` | The room's five kitchen finishes, each drawn as a kitchen reduced to stripes: wall units, splashback, worktop, base fronts. Together they make a stripe wall. The scroll opens the columns in turn; hover opens one; a click picks it for the room (the `kencho:finish` event plus localStorage). |
| (04) Outro | `Outro.tsx` | White on orange to the lid's very edge: "Now, design yours." KENCHO stands up letter by letter in white. |
| The room | `RoomFooter.tsx` | The footer: a sticky, full-screen layer under the page. It draws itself the first time it is 40% uncovered and sleeps when covered. Its TV (Contacts) goes to the main site's contact page. |

## The narrator

These lines play as their sections arrive, if the sound is on:
- `page-hello`
- `page-pieces`
- `page-finishes`
- `page-room`

They are listed in `scripts/room-voice.json`. The room keeps its own lines.

## Checks

Start the dev server first (`room-dev`).

- `npm run page:shots`: screenshots. Options:
  - `SHOTS_PHONE=1`: phone viewport;
  - `SHOTS_AT='[["pieces",0.5]]'`: chosen points;
  - `SHOTS_INTRO=1`: play the opening first.
- `npm run page:check`: interaction checks:
  - the frame rate of a full sweep;
  - a palette picked and stored for the room;
  - the room uncovered and drawn, with the navbar out of its way;
  - Contacts pointing to the main site;
  - the menu, and its jump to the room.

- `npm run perf:mem`: an iPhone viewport at 3x. At each moment it reports the composited layers and what their backing stores would cost at full size, plus decoded images and canvases. `PROBE_OPENING=1` probes the opening first.
- `npm run og:image`: redraws `public/og.jpg` (1200 x 630) and the app icons from the page's type, colours and hero photo.

Last run (phone, headless): average 59 fps, median frame 16.7 ms; no console errors.

## Phones: memory

iOS Safari kills a tab that holds too much layer memory. It reloads the tab, and if that crashes too it shows "A problem repeatedly occurred". Layers are costed at width x height x 3² x 4 bytes on a 3x iPhone, and WebKit only tiles layers over 2000 px.

- The arrival burst once scaled five 300vmax circles with GPU transforms: 2532 px each on a phone, about 230 MB per layer. Each ring is now the screen itself, uncovered through a growing `clip-path: circle()`. The burst leaves the document once it has played.
- Never animate an oversized element with `scale` to cover the screen. Clip a screen-sized one instead.
- On phones, the opening's zoom exits fly to 2.2x with a 12px blur (4x and 24px on desktop).

## Search and analytics

- `index.html` holds the title, description, Open Graph and Twitter cards, and JSON-LD:
  - the WebSite;
  - the WebPage;
  - Kencho Group as a FurnitureStore, with its address, phone and hours from `src/page/content.ts`.
  - It also holds a hidden copy of the page's text for crawlers that don't run JavaScript.
- Crawlers (`bot/`, crawler, spider… in the user agent) skip the opening and get the page itself, the same page people reach after it.
- `public/robots.txt`, `sitemap.xml` (with the page's photos), `llms.txt`, `site.webmanifest` and the icons.
- Vercel Web Analytics is the `<Analytics />` in `src/main.tsx`; turn it on in the Vercel dashboard. Ahrefs Web Analytics is the script in `index.html`. Both are cookieless, so no consent banner.
- `vercel.json` sets the cache headers:
  - hashed `/assets` for a year;
  - `/media` for a day, revalidating in the background.
