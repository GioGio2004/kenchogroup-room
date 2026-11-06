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
| Arrival | `Page.tsx` | Coloured rings burst out of the opening, then the hero lands. |
| Hero | `Hero.tsx` | Three lines of serif land letter by letter beside a real kitchen in a plain arch. Book a meeting goes to kenchogroup.ge. |
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

Last run (desktop, headless): average 54 fps, median frame 16.7 ms; no console errors.
