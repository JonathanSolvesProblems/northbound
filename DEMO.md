# Northbound demo, 3-5 minutes

This video is the entire presentation, since the entry is submitted remotely. Target 4:00 to 4:30. Every number spoken is one `check_claims.py` verifies, and every screen is a real command on real data. Nothing is seeded.

**Record the terminal at a large font (18pt+), dark theme, window about 110 columns wide.** Record each shot as its own clip, then cut to the narration. Do not narrate live over a running command; the model calls take 5 to 20 seconds and the pauses read as broken.

---

## Narration, with timings

```
0:00  [SHOT 1: title card]
      Roadstar Trucking runs 82 trucks out of Milton, Ontario, into the
      United States. This hackathon handed me two months of their dispatch
      history. I built Northbound on it, and the first thing the data did
      was prove me wrong.

0:18  [SHOT 2: empty_miles.py output, the lane table]
      I assumed a Canadian carrier's problem is coming home empty from the
      Midwest. Six legs. Two thousand miles. In two months. They are good
      at loading for home.

      The empty running is inside the States, between loads. Seven hundred
      and seventy-eight legs. A hundred and twenty-six thousand miles.

0:40  [SHOT 3: LEGAL.md, the 19 CFR 123.14(c)(1) quote highlighted]
      Here is the part nobody prices. A Canadian truck cannot haul US
      freight that moves away from home. Everyone knows that. But the
      regulation is not a flat no. Nineteen CFR one-twenty-three point
      fourteen says carriage "as part of the return of the vehicle to its
      base country" is incidental to international traffic. Allowed.

      So it is directional. Which way is the load going.

1:05  [SHOT 4: fillable.py output, the headline block]
      Two hundred and seventeen of those empty legs were already pointed at
      the border. Sixty-six thousand seven hundred miles. Every one of them
      could legally have been carrying freight. At ATRI's published
      industry cost, that is a hundred and fifty-five thousand dollars in
      two months, on running they were already paying for.

1:28  [SHOT 5: offer.ts, Fairburn GA -> Walton KY, AMBER]
      Northbound is the load board that knows the difference. A dispatcher
      pastes the offer the way it arrived. GLM 5.2 on SPUR reads it: van,
      forty-two thousand pounds, fourteen-fifty all in, pickup on the
      twelfth. Then the law decides.

      Fairburn to Walton is US domestic, and it is heading home. Amber.
      Worth a call to your broker. Here is the provision. Roadstar ran that
      exact lane empty ten times in two months.

2:00  [SHOT 6: offer.ts, Columbus OH -> Atlanta GA, RED]
      Now the one that looks like easy money. Columbus to Atlanta, twenty-one
      hundred dollars, your truck is sitting right there.

      Red. Not offered to this truck. Moving away from home is the cabotage
      violation the regulation warns of: section 592 liabilities, and the
      driver's B-1 admission at risk on his next entry. Twenty-one hundred
      dollars is not worth the truck.

2:25  [SHOT 7: board.ts, Driver84's block]
      It also knows the clock changes at the bridge. Roadstar's own system
      tracks US and Canadian hours as separate columns, and eighty-eight
      percent of their drivers carry a different number on each.

      Driver84. Fifty-three hours on the US cycle. Eleven the moment he
      crosses. His board says he is fine. He is not.

      And the wait at the bridge never touches his driving limit. It costs
      the fourteen-hour window instead, and past thirty minutes it counts as
      the break he already owed. Live from CBP, both lanes.

2:55  [SHOT 8: overlap.py output, the Fairburn / Atlanta pairing]
      Now the one I did not expect. A hundred and twenty times in two
      months, a Roadstar truck ran empty toward the border within a
      hundred and fifty kilometres and forty-eight hours of a Roadstar load
      going to Ontario.

      Driver67 ran empty out of Fairburn, Georgia. The day before, their own
      load left Atlanta for Etobicoke. Those towns are twenty miles apart.
      Same company. Two trucks. One of them empty.

3:22  [SHOT 9: ablation.ts output, the verdict row]
      Everyone at a sponsored hackathon says the sponsor's model was
      essential. I measured it. Same offers, read twice, once by GLM 5.2 and
      once by a real regex parser with the model off.

      With the model, a hundred percent of offers reach the correct legal
      verdict. Without it, forty. The regex handles a tidy header block
      fine. It cannot read a chat message or a forwarded email, and that is
      what freight actually looks like.

3:45  [SHOT 10: check_claims.py, the PASS line]
      One more thing. Every number I just said is recomputed from the raw
      sheets by a script that fails the build if the prose and the data
      disagree. The first time I ran it, it caught four mistakes in my own
      writeup.

3:58  [SHOT 11: title card with the tagline]
      Northbound. Your truck already drove that lane, empty. This finds the
      freight it could legally have carried.
```

Total about 4:10.

---

## Shot list, exact commands

Run each in a fresh terminal at the repo root. `set -a; . ./.env; set +a` first for anything that calls the model.

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

github.com/<user>/northbound
```

---

## What not to do

- Do not narrate live over model calls. Record the output, cut to it.
- Do not show the `.env` or any terminal with the key visible.
- Do not speed up or trim command output that would change a number.
- Do not say "AI" where "GLM 5.2 on SPUR" is what happened. The sponsor's model is named every time it does something.
- Do not add anything the script does not say. If a beat feels short, it is the right length.
