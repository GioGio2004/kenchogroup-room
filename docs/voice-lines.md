# Room voice lines (options to generate)

Voice: the same as the opening, ElevenLabs "Chris – Warm, Friendly, and Engaging",
v3 audio tags in [brackets]. Each line has 3–5 takes, so return visitors rarely
hear the same thing twice.

## How the room will use them

- **One voice at a time.** A click line can cut off an idle or time line (a short
  fade). Nothing else interrupts, and lines never stack.
- **Each take plays once.** The browser remembers which takes a visitor has heard,
  and later visits pick a fresh one. Nothing is sent anywhere.
- **Unprompted lines** (idle, time on site, tab return) wait at least 10 s after
  any other line, and never play during a camera move.
- **Lines before a redirect** to kenchogroup.ge must be short (≤ 2.5 s), or the
  redirect waits for them. The door walk-through has about 6 s.
- **Voice only, no captions.** Nothing appears on screen while the narrator speaks.
- **Muted means silent.** The room's voice starts from the intro's choice (Start
  = on, "Continue without sound" = off), and the **Narrator's voice** switch in
  the menu turns it off. While it's off, no line plays at all.

## Generating

- One file per take: mp3, 44.1 kHz, silence trimmed at both ends, levels
  matched to the opening.
- Name each file `<id>-<take>.mp3`, for example `kitchen-first-1.mp3`, and put it
  in `public/media/audio/room/`.
- Make sound effects as separate files (`sfx-bell.mp3`, `sfx-door-creak.mp3`,
  `sfx-kettle.mp3`) rather than as tags inside a voice line. I'll layer them, so
  the voice stays clean and the effects can be reused.
- **Start with these seven:** `kitchen-first`, `kitchen-second`, `gallery-first`,
  `door-walk`, `contacts-click`, `idle-20s`, `arrive-return`.

---

## 1. Arriving in the room
These play about a second after the drawing finishes.

**`arrive-first`** (first ever visit; the intro has just said "see what feels like home")
1. [softly] Go on. It's all yours.
2. [chuckles] Make yourself at home. Shoes optional.
3. Click on anything. [playfully] I promise I won't bite.

**`arrive-return`** (back on another day)
1. [delighted] You're back! I knew you'd come back.
2. Oh, hello again. [chuckles] Couldn't stop thinking about that kitchen, could you?
3. Welcome back. [playfully] I kept everything exactly where you left it.
4. Back so soon? [laughs] I'll pretend I'm not flattered.

**`arrive-morning` / `-afternoon` / `-evening` / `-night`** (optional, by local time; one or two takes each)
- Morning: Up early? [warmly] Coffee and kitchens. My favourite combination.
- Afternoon: Perfect time for a little daydreaming. [softly] Go on, look around.
- Evening: Long day? [softly] Put your feet up. Let's talk kitchens.
- Night: [whispers] Late-night kitchen planning? The best ideas show up after dark.

## 2. Idle nudges

**`idle-20s`** (no click for about 20 s)
1. [whispers] Psst… the kitchen's clickable, you know.
2. Go on, click something. [chuckles] I promise nothing breaks.
3. [curious] Thinking? Take your time… or click the kitchen. Either works.
4. Not sure where to start? [playfully] The kitchen. It's always the kitchen.

**`idle-60s`**
1. Still there? [whispers] I can hear you thinking.
2. [sighs] Don't mind me… just waiting for you to click something.
3. [chuckles] You've been staring at that wall for a while. It's a good wall.
4. Hellooo? [laughs] Okay, okay… I'll be quiet.

## 3. The kitchen

**`kitchen-first`**
1. It's me again. [chuckles] So you finally made it. [playfully] Try the different colours… and the different angles too. Don't hold back.
2. [excited] Ah, the kitchen! My favourite room. Pick a finish down below, go wild.
3. Here we are. [playfully] Every colour down there is a kitchen we've actually built. Try them on.
4. [warmly] Pull up a stool. Now… hover over anything, and I'll tell you what it's made of.

**`kitchen-second`** (with `sfx-bell` in line 1)
1. I see you're getting used to it. [bell] How's it going so far?
2. Back in the kitchen? [chuckles] Told you. It's always the kitchen.
3. Oh, round two. [playfully] Found your colour yet?
4. [knowingly] Couldn't stay away, could you?

**`kitchen-again`** (third visit and after)
1. At this point you're basically family. [laughs] Help yourself.
2. Third time's the charm. [playfully] Shall we just build it?
3. [whispers] I won't tell anyone how often you come in here.

**`kitchen-materials`** (first hover over a part)
1. Go on, explore. [whispers] Quartz on top, oak underneath.
2. [curious] Hover around. I'll tell you what everything's made of.
3. Every material here is something we really use.

**`finish-first`** (first change of finish)
1. Ooh. [impressed] Look at that.
2. [playfully] Now we're talking.
3. See? Same kitchen, whole new mood.

**After that, one line per finish:**

**`finish-sage`**
1. Sage and oak. [softly] Calm, warm… very you.
2. Sage. [chuckles] The colour of people who own good olive oil.
3. Classic sage. It never goes out of style.

**`finish-forest`**
1. Forest green. [approvingly] Bold. I like you already.
2. Ooh, forest green. That's the one everybody asks about.
3. [playfully] Deep green and walnut… someone has taste.

**`finish-white`**
1. Warm white. [softly] Clean, bright, timeless.
2. Warm white… feels like a Sunday morning, doesn't it?
3. The safe choice? [chuckles] No. The smart one.

**`finish-greige`**
1. Greige. [playfully] Not grey, not beige… perfectly in between.
2. A little greige, just like I said. [chuckles] I knew it.
3. Greige and graphite. Very grown-up.

**`finish-terracotta`**
1. [laughs] Terracotta! Now that's a seventies kitchen.
2. Retro terracotta… my grandmother would approve.
3. Brave. [playfully] I love brave.

**`kitchen-indecisive`** (four or more finish changes in quick succession)
1. Can't decide? [laughs] Neither can most of our clients.
2. [playfully] Take your time. They all look good on you.
3. Tell you what… we can mix them. Just ask.
4. [chuckles] Okay, okay. Don't wear out the swatches.

**`kitchen-linger`** (45 s or more in the close-up)
1. You've been here a while. [warmly] When you're ready, "Build this kitchen" is right there.
2. Seeing yourself in it yet? [softly] That's how it starts.
3. Good kitchens are never rushed. [pause] But they do get built. Bottom right.

## 4. The gallery wall

**`gallery-first`**
1. [excited] Ahh, yes! Our gallery. You can see the full one on our official page… just click through!
2. Real kitchens, real homes. [proudly] All built right here in Tbilisi.
3. [playfully] These four are just the warm-up. The full gallery's one click away.
4. Ooh, take a look. [softly] Every one of these started as a sketch, just like this room.

**`gallery-again`**
1. Back for another look? [chuckles] Spotted a favourite yet?
2. They don't get old, do they?
3. [playfully] Tell me which one, and I'll pretend I'm not biased.

**`gallery-hover`** (first photo hover; short)
1. Ooh, that one's a favourite.
2. [softly] Look at those details.
3. Good eye.

**`gallery-leave`** (clicking through to the full gallery; ≤ 2.5 s)
1. Off you go! [chuckles] Come back and tell me.
2. Enjoy the tour.
3. [whispers] Bring back ideas.

## 5. The workshop (About us)

**`door-hover`** (first hover, as the door swings ajar; ≤ 1.5 s, optional, with `sfx-door-creak`)
1. [whispers] Curious?
2. [chuckles] Go on, peek.
3. [mischievously] That's where the magic happens.

**`door-walk`** (during the walk in, before "taking you to…"; ≤ 6 s)
1. Mind the sawdust. [chuckles] This is where it all gets made.
2. [proudly] Welcome to the workshop. Every piece starts right here.
3. Smell that? [inhales] Fresh oak. Best smell in the world.
4. Careful, it's a bit messy. [laughs] Creative people, you know.
5. This is us. [warmly] Let me introduce you properly.

**`door-again`**
1. Back in the workshop? [laughs] You'll be asking for a job next.
2. Couldn't get enough of the sawdust, eh?
3. [playfully] Same door. Still squeaky.

**`door-stay`** (clicked "Stay in the room")
1. Changed your mind? [laughs] The door's always open.
2. Fair enough. Plenty to see out here.
3. [chuckles] Not ready to meet the team? That's okay.

## 6. Contacts (the media wall and TV)

**`tv-hover`** (first hover; ≤ 1.5 s, optional)
1. [whispers] Psst… this is where we talk.
2. Your wall, your idea.
3. [playfully] Got something in mind?

**`contacts-click`** (≤ 2.5 s, then the redirect; `sfx-kettle` optional under line 1)
1. Let's talk. [warmly] I'll put the kettle on.
2. [excited] Oh, good! Let's make it happen.
3. Finally! [laughs] Tell us everything.
4. Smart move. We'll be in touch.

## 7. Phones

**`swipe-first`**
1. That's it. Have a wander.
2. [playfully] Swipe away. I'll follow.
3. Look around. Take your time.

**`swipe-all`** (seen all four stops)
1. Seen the whole place. [curious] So… where to?
2. That's the grand tour. [chuckles] Pick a corner.
3. Every corner covered. Now for the fun part.

## 8. Time on the site

**`time-1min`**
1. One whole minute. [chuckles] You're comfortable, aren't you?
2. Settling in? Good.
3. [softly] Nice in here, isn't it? No rush.

**`time-3min`**
1. Three minutes in. [laughs] Should I start charging rent?
2. You know, most people just look. You're actually thinking about it.
3. [playfully] At this point, we're friends.

**`time-5min`**
1. Honestly? [laughs] You might as well design the whole house. Contacts is by the TV.
2. Five minutes. [warmly] I think you've found your kitchen.
3. Okay, I'm convinced. You're ready. Let's talk.

## 9. Coming back, replaying

**`tab-return`** (back after 30 s or more on another tab)
1. Oh, you're back! [chuckles] I thought you'd left me.
2. [playfully] Welcome back. I didn't touch anything.
3. There you are. Showing someone? [laughs] Tell them I said hi.

**`replay-intro`**
1. Again? [chuckles] Okay, from the top.
2. [playfully] An encore? I'm flattered.
3. You liked that, huh? Here we go.
