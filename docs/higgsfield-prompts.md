# Opening scene — Higgsfield shot list

The opening currently runs on Kencho's real photographs (`public/media/frames`).
These prompts produce the cinematic version: one continuous camera through one
apartment, cut into clips that chain end-frame → start-frame. Each clip
replaces the matching beat in `src/scenes/opening/Narration.tsx`; the narration
timing (`src/lib/narration.ts`) stays the same.

## Rules for every shot

- **One apartment.** Generate shot 1's start still first, then feed each clip's
  final frame in as the next clip's first frame. Never regenerate the room
  from text alone mid-sequence, or the geometry will drift.
- **Style suffix** (append to every prompt):
  > photoreal architectural film, new-build Tbilisi apartment, soft
  > late-afternoon daylight through tall windows, warm white walls, polished
  > concrete floor, 35mm lens, eye-level, slow steady gimbal move, shallow
  > depth of field, no people, no text, no logos, calm and minimal, 4K
- **Negative:** people, hands, text, watermark, fisheye, fast motion, camera
  shake, clutter, upholstered furniture (except shot 4), cartoon, CGI look.
- **Formats:** render every shot twice, 16:9 (desktop) and 9:16 (phones).
- **Length:** match the beat; extra length is trimmed, so allow +1 s.

## Shots

| # | Beat (narration) | Length | Prompt |
|---|---|---|---|
| 1 | 0.0–3.8 "Hellooo… You finally found us." | 4 s | Black frame; a heavy front door swings open toward the camera and soft daylight floods in, revealing an empty, freshly finished apartment hallway. Camera holds, then begins a slow push forward through the doorway. |
| 2 | 3.8–7.9 "Let's make your dream kitchen happen." | 4–5 s | Continuing forward into an empty open-plan room; along the back wall a bespoke kitchen assembles itself: walnut upper cabinets slide into place, white handle-less lower fronts glide in, a long island rises from the floor with fluted timber sides. Smooth, satisfying, precise, like a time-lapse of craftsmanship. |
| 3 | 7.9–11.1 "Or other furniture, for that matter." | 3–4 s | Camera pans right, away from the finished kitchen, to a bare wall where a floor-to-ceiling oak-framed wardrobe with white panels assembles door by door, then built-in shelving appears beside it. |
| 4 | 11.1–14.4 "Just nothing upholstered. No, no, no…" | 3 s | In the middle of the room a plump beige sofa begins to fade into existence, hesitates, then dissolves back into nothing as if rejected. Playful but elegant timing. (Allow upholstery in this shot only.) |
| 5 | 14.4–19.5 "So… what are you looking for? A kitchen? Or perhaps…" | 5 s | Slow drift back to the kitchen, settling into a wide, centred, symmetrical hero view of the island and wall. Camera comes to rest and holds still for the last second: this frame is the colour station. |
| 6a–c | 19.5–24.0 "Forest green… warm white… a little greige?" | 1 still each | From shot 5's final frame, image-edit only the cabinet fronts: (a) deep forest green matt lacquer, (b) warm white matt lacquer, (c) light greige matt lacquer. Keep walls, floor, island top, lighting and camera identical. Also export a black-and-white mask of the cabinet fronts. That mask drives the live WebGL recolour later. |
| 7 | 24.0–30.2 "…I'll give you some space. Have a look around." | 6 s | From the chosen colour still, the camera slowly pulls back and rises a little, revealing the whole apartment: kitchen, wardrobe wall and tall windows, ending on a calm wide establishing frame. Final second holds still (this becomes the room-as-homepage hub). |

## After generation

1. Drop clips in `public/media/video/opening-{n}-{16x9|9x16}.mp4` (H.264 for
   compatibility plus a WebM/AV1 copy, about 6–8 Mbps desktop, 3–4 Mbps phone).
2. Export each clip's last frame as `public/media/frames/opening-{n}-end.webp`
   (the poster that shows while the next clip loads).
3. The timeline swaps each `<img>` beat for a `<video>` scrubbed to the
   narration clock (`video.currentTime = t - beatStart`).
