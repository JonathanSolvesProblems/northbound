# Northbound demo, 3-5 minutes

This video is the entire presentation, since the entry is submitted remotely. Target 4:00 to 4:30. Every number spoken is one `check_claims.py` verifies, and every screen is a real command on real data. Nothing is seeded.

**Record the terminal at a large font (18pt+), dark theme, window about 110 columns wide.** Record each shot as its own clip, then cut to the narration. Do not narrate live over a running command; the model calls take 5 to 20 seconds and the pauses read as broken.

---

## Read this

Straight through, at a normal speaking pace. About four minutes. Pause a beat between paragraphs; each one is a cut.

Roadstar Trucking runs eighty-two trucks out of Milton, Ontario, into the United States. This hackathon handed me two months of their real dispatch history. I built Northbound on it, and the first thing the data did was prove me wrong.

I assumed a Canadian carrier's problem is coming home empty from the Midwest. Their own records say otherwise. Six empty legs home. Two thousand miles. In two months. They are good at loading for home. The empty running is inside the States, between loads. Seven hundred and seventy-eight legs. A hundred and twenty-six thousand miles.

Here is the part nobody prices. A Canadian truck cannot haul US freight that moves away from home. Everyone in the industry knows that. But the regulation is not a flat no. Nineteen CFR one twenty-three point fourteen says carriage as part of the return of the vehicle to its base country counts as incidental to international traffic. Which means it is allowed. So the rule is directional. It comes down to which way the load is going.

Two hundred and seventeen of those empty legs were already pointed at the border. Sixty-six thousand seven hundred miles. Every one of them could legally have been carrying freight. At ATRI's published industry cost per mile, that is a hundred and fifty-five thousand dollars in two months, on running they were already paying for.

Northbound is the load board that knows the difference. A dispatcher pastes the offer the way it arrived, a one-line message from a broker. GLM 5.2 on SPUR reads it. Van, forty-two thousand pounds, fourteen fifty all in, pickup on the twelfth. Then the law decides. Fairburn, Georgia to Walton, Kentucky is US domestic, and it is heading home. Amber. Worth a call to your broker, and here is the provision. Roadstar ran that exact lane empty ten times.

Now the one that looks like easy money. Columbus to Atlanta, twenty-one hundred dollars, and your truck is sitting right there. Red. Not offered to this truck. Moving away from home is the cabotage violation the regulation warns about. Section five ninety-two liabilities, and the driver's B-1 admission at risk the next time he crosses. Twenty-one hundred dollars is not worth the truck.

It also knows the clock changes at the bridge. Roadstar's own system tracks US and Canadian hours as separate columns, and eighty-eight percent of their drivers carry a different number on each. Driver eighty-four. Fifty-three hours on the US cycle. Eleven the moment he crosses. And the wait at the bridge never touches his driving limit. Past thirty minutes, it counts as the break he already owed. Live from CBP, both lanes.

Now the one I did not expect. A hundred and twenty times in two months, a Roadstar truck ran empty toward the border within a hundred and fifty kilometres and forty-eight hours of a Roadstar load going to Ontario. Driver sixty-seven ran empty out of Fairburn, Georgia. The day before, their own load left Atlanta for Etobicoke. Those towns are twenty miles apart. Same company. Two trucks. One of them empty.

Everyone at a sponsored hackathon says the sponsor's model was essential. I measured it. The same hundred offers, read twice. Once by GLM 5.2, once by a real regex parser with the model switched off. With the model, a hundred percent reach the correct legal verdict. Without it, forty. The regex handles a tidy header block just fine. It cannot read a chat message or a forwarded email, and that is what freight actually looks like.

One more thing. Every number I just said is recomputed from the raw sheets by a script that fails the build if the prose and the data disagree. The first time I ran it, it caught four mistakes in my own writeup.

Northbound. Your truck already drove that lane, empty. This finds the freight it could legally have carried.

---

## Narration, with timings (for editing)

Opens on the page so a judge has the identity in three seconds, then cuts to the
terminal wherever realness is the point. Every number spoken is one
`check_claims.py` verifies. Nothing is seeded.

```
0:00  [00-page-hero, the sign with the sweep]
      Roadstar Trucking runs 82 trucks out of Milton, Ontario, into the
      United States. This hackathon handed me two months of their dispatch
      history. I built Northbound on it, and the first thing the data did
      was prove me wrong.

0:16  [02-empty-miles, terminal, the lane table]
      I assumed a Canadian carrier's problem is coming home empty from the
      Midwest. Six legs. Two thousand miles. In two months. They are good
      at loading for home. The empty running is INSIDE the States, between
      loads. Seven hundred and seventy-eight legs. A hundred and twenty-six
      thousand miles.

0:36  [00-page-scroll, gliding down to the three verdict signs]
      Here is the part nobody prices. A Canadian truck cannot haul US
      freight that moves away from home. Everyone knows that. But the
      regulation is not a flat no. Nineteen CFR one-twenty-three point
      fourteen says carriage "as part of the return of the vehicle to its
      base country" is incidental to international traffic. Allowed.
      So it is directional. Which way is the load going.

1:00  [00-page-headline, the destination list]
      Two hundred and seventeen of those empty legs were already pointed at
      the border. Sixty-six thousand seven hundred miles. Every one of them
      could legally have been carrying freight. At ATRI's published industry
      cost, that is a hundred and fifty-five thousand dollars in two months,
      on running they were already paying for.

1:22  [05-offer-amber, terminal]
      Northbound is the load board that knows the difference. A dispatcher
      pastes the offer the way it arrived. GLM 5.2 on SPUR reads it: van,
      forty-two thousand pounds, fourteen-fifty all in, pickup on the
      twelfth. Then the law decides. Fairburn to Walton is US domestic, and
      it is heading home. Amber. Worth a call to your broker. Roadstar ran
      that exact lane empty ten times.

1:52  [06-offer-red, terminal]
      Now the one that looks like easy money. Columbus to Atlanta,
      twenty-one hundred dollars, your truck is sitting right there.
      Red. Not offered. Moving away from home is the cabotage violation the
      regulation warns of: section 592 liabilities, and the driver's B-1
      admission at risk on his next entry. Twenty-one hundred dollars is
      not worth the truck.

2:18  [07-board, terminal, Driver84]
      It also knows the clock changes at the bridge. Roadstar's own system
      tracks US and Canadian hours as separate columns, and eighty-eight
      percent of their drivers carry a different number on each. Driver84.
      Fifty-three hours on the US cycle. Eleven the moment he crosses. And
      the wait at the bridge never touches his driving limit; past thirty
      minutes it counts as the break he already owed. Live from CBP.

2:48  [08-overlap, terminal, the Fairburn / Atlanta pairing]
      Now the one I did not expect. A hundred and twenty times in two
      months, a Roadstar truck ran empty toward the border within a hundred
      and fifty kilometres and forty-eight hours of a Roadstar load going to
      Ontario. Driver67 ran empty out of Fairburn, Georgia. The day before,
      their own load left Atlanta for Etobicoke. Twenty miles apart. Same
      company. Two trucks. One of them empty.

3:14  [09-ablation, terminal]
      Everyone at a sponsored hackathon says the sponsor's model was
      essential. I measured it. Same hundred offers, read twice: once by
      GLM 5.2, once by a real regex parser with the model off. With the
      model, a hundred percent reach the correct legal verdict. Without it,
      forty. The regex handles a tidy header block. It cannot read a chat
      message or a forwarded email, and that is what freight looks like.

3:38  [10-check-claims, terminal]
      Every number I just said is recomputed from the raw sheets by a script
      that fails the build if the prose and the data disagree. The first
      time I ran it, it caught four mistakes in my own writeup.

3:50  [00-page-close, then 11-close card]
      Northbound. Your truck already drove that lane, empty. This finds the
      freight it could legally have carried.
```

Total about 4:00.

---

## B-roll is already captured

Every shot below exists as video in `broll/`, recorded automatically from the real commands on the real data:

```bash
python scripts/broll.py            # run every command, record each as 1920x1080 mp4
python scripts/broll.py --replay   # re-record from the captured output, no re-running
python scripts/broll.py --page     # record the deployed project page, scrolling
python scripts/cards.py            # title and end cards, with the headshot
```

| File | Length | What it holds on |
|---|---|---|
| `00-page-hero.mp4` | 6s | the sign, headlight sweep on entry |
| `00-page-scroll.mp4` | 22s | a slow glide from the top to the headline sign |
| `00-page-headline.mp4` | 10s | 217 / 66,702 / $155,815 as a destination list |
| `00-page-verdicts.mp4` | 11s | the two offer recordings inside the sign |
| `00-page-close.mp4` | 9s | the footer shield and links |
| `01-title.mp4` | 4s | branded card |
| `02-empty-miles.mp4` | 10s | the four-row lane table |
| `03-the-rule.mp4` | 12s | the (c)(1) quote |
| `04-headline.mp4` | 13s | the boxed $155,815 |
| `05-offer-amber.mp4` | 16s | AMBER, both citations |
| `06-offer-red.mp4` | 22s | RED, the § 592 line |
| `07-board.mp4` | 17s | Driver84, `LOSES 42.1h` |
| `08-overlap.mp4` | 14s | the Fairburn / Atlanta pairing |
| `09-ablation.mp4` | 14s | the `CORRECT LEGAL VERDICT` row, n = 100 |
| `10-check-claims.mp4` | 11s | `PASS` |
| `11-close.mp4` | 6s | branded card with tagline and repo |
| `12-cfr-123-14.mp4` | 29s | 19 CFR 123.14 on Cornell LII, (c)(1) boxed, § 592 below it |
| `13-atri-cost.mp4` | 18s | ATRI's July 2026 release, the $2.336 sentence boxed |
| `14-cbp-waits.mp4` | 22s | bwt.cbp.gov, live, scrolling the crossings |
| `15-cfr-395-3.mp4` | 10s | 49 CFR 395.3, the 30-minute break |

Each clip opens on the command being typed, streams the real output, then eases to the line named above and holds. Beside each `.mp4` is a `.txt` of the raw output, and `broll/_stills/` holds a `.png` of the final frame, so anyone can confirm nothing on screen was edited. (The stills live in their own folder because vidkit prefers `name.png` over `name.mp4` when both sit together, and then every beat renders as a slide.)

**The rule for the edit:** whenever the narration cites a number, the source is on screen. `scripts/edit_plan.py` authors the vidkit plan by hand so that is guaranteed: "19 CFR" cuts to Cornell, "ATRI" cuts to the July 2026 release, "live from CBP" cuts to bwt.cbp.gov. It also proofreads the Whisper transcript before captions burn in.

```bash
python scripts/edit_plan.py                                   # plan + padded narration
vidkit assemble broll/narration/narration-padded.mp3 --clips-dir broll --edit-plan broll/demo.edit-plan.json --out broll/demo.mp4
ffmpeg -y -i broll/demo.mp4 -c:v copy -c:a aac -ar 48000 -b:a 192k -movflags +faststart broll/demo-48k.mp4 && mv -f broll/demo-48k.mp4 broll/demo.mp4   # loudnorm leaves 96 kHz audio
python scripts/check_video.py broll/demo.mp4                  # length, loudness, black frames, motion, blank openings, mid-beat frames
```

`check_video.py` writes one frame from the middle of every beat to `broll/_frames/`. The last step is looking at them: the regulation, the ATRI release and the CBP page have to be the thing on screen while their number is spoken.

## Shot list, exact commands

The same commands, if you would rather screen-record by hand. Run each in a fresh terminal at the repo root. `set -a; . ./.env; set +a` first for anything that calls the model.

| Shot | Command | Hold on |
|---|---|---|
| 1 | title card (see below) | 3s |
| 2 | `python scripts/empty_miles.py` | scroll to `EMPTY LEGS BY DIRECTION`, rest on the four-row table |
| 3 | open `LEGAL.md` in the editor | the (c)(1) blockquote, zoomed |
| 4 | `python scripts/fillable.py` | the boxed headline, then the repeating-lanes table |
| 5 | `npx tsx src/cli/offer.ts --driver Driver67 "van, Fairburn GA to Walton KY, pu 9/12 0700-1200, 42k, $1450 all in"` | the "What the model read" block, then AMBER |
| 6 | `npx tsx src/cli/offer.ts --driver Driver18 "Hey, got a hot one. Columbus OH to Atlanta GA, loads tomorrow morning, 38,500 lbs dry van, paying $2,100. Your guy's sitting right there, can he grab it?"` | RED, rest on the § 592 line |
| 7 | `npx tsx src/cli/board.ts` | scroll to Driver84 (`LOSES 42.1h crossing`), then one border line showing FAST vs standard |
| 8 | `python scripts/overlap.py` | the boxed 120 line, then the Driver67 example |
| 9 | `npx tsx src/cli/ablation.ts 30` (pre-record, it takes minutes) | the `CORRECT LEGAL VERDICT` row, then the by-format table |
| 10 | `PYTHONIOENCODING=utf-8 python scripts/check_claims.py` | the last line, `PASS` |
| 11 | title card | 4s |

Shot 9 is slow to produce. Record it first, before anything else, and keep the clip.

## Title cards

Plain, dark background, one typeface. No logo, no animation.

**Opening:**
```
NORTHBOUND

Built on Roadstar Trucking's dispatch history
RoadStar Hackathon 2026
```

**Closing:**
```
Your truck already drove that lane. Empty.
Northbound finds the freight it could legally have carried.

github.com/JonathanSolvesProblems/northbound
```

---

## What not to do

- Do not narrate live over model calls. Record the output, cut to it.
- Do not show the `.env` or any terminal with the key visible.
- Do not speed up or trim command output that would change a number.
- Do not say "AI" where "GLM 5.2 on SPUR" is what happened. The sponsor's model is named every time it does something.
- Do not add anything the script does not say. If a beat feels short, it is the right length.

## The Short (28 s, 1080x1920)

The red refusal on its own: `$2,100`, Columbus to Atlanta, not offered, the regulation quoted, "$2,100 is not worth the truck." Four portrait cards in the page's own sign language (`broll/short_shots.py`), rendered against the same narration cut from 130.0 s to 158.5 s of `narration.mp3`. Output `broll/short.mp4`, upload copy in `broll/short.metadata.md`.

```bash
python "$USERPROFILE/.claude/skills/create-short/assets/portrait_broll.py" broll/short_shots.py --out broll/vertical
python "$USERPROFILE/.claude/skills/create-short/assets/make_short_plan.py" broll/demo.edit-plan.json --audio broll/narration/narration.mp3 --window 130.0 158.5 --clips-dir broll/vertical --out-plan broll/demo.short.edit-plan.json --out-audio broll/narration/narration.short.mp3
# then split the one segment across 01-hook / 02-red / 03-law / 04-payoff at word boundaries (8.5, 15.3, 25.0 s)
vidkit assemble broll/narration/narration.short.mp3 --clips-dir broll/vertical --edit-plan broll/demo.short.edit-plan.json --out broll/short.mp4
ffmpeg -y -i broll/short.mp4 -c:v copy -c:a aac -ar 48000 -b:a 192k -movflags +faststart broll/short-48k.mp4 && mv -f broll/short-48k.mp4 broll/short.mp4
```
