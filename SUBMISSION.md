# Submission fields

Paste each block exactly. Nothing inside a section except the value. Notes are at the bottom, below every field.

## Project name

```
Northbound
```

## Tagline

```
Your truck already drove that lane. Empty. Northbound finds the freight it could legally have carried.
```

## Inspiration

```
This hackathon handed me two months of Roadstar Trucking's real dispatch history: 10,479 completed legs, an order book of 4,031 loads, and a driver roster where every driver carries two separate hours-remaining figures, one for the US and one for Canada. That last detail is the whole project. A cross-border carrier lives under two rulebooks, and its trucks spend weeks at a time inside a country whose freight they are mostly not allowed to haul.

I went in assuming the problem was coming home empty from the Midwest. Their data said no: six empty legs home in two months. The empty running is inside the United States, between loads, and whether any of it could have carried freight turns out to be a legal question rather than a routing one.
```

## What it does

```
Northbound is a load board that knows which US freight a Canadian truck is legally allowed to haul.

A dispatcher pastes an offer the way it actually arrived, as a broker's email or a one-line chat message. GLM 5.2 on SPUR reads it into structured fields. Then the law decides: 19 CFR 123.14(c)(1) permits a foreign-based truck to carry US point-to-point freight only "as part of the return of the vehicle to its base country," so the verdict turns on which direction the load runs. Green is international. Red is moving away from home, and Northbound names the exposure: section 592 of the Tariff Act and the driver's B-1 admission. Amber is US domestic but heading home, surfaced with both citations and handed to the carrier's broker.

It also plans the clock across the border, because the same driver has different hours on each side. Driver84 in Roadstar's roster shows 53 hours on his US cycle and 11 the moment he crosses. Border wait is priced live from CBP, commercial and FAST lanes separately, and a wait over 30 minutes is credited as the break the driver already owed.

And it looks back. In Roadstar's own history it found 217 empty legs, 66,702 miles, that were already travelling toward the border and could legally have carried freight: $155,815 at ATRI's published 2025 industry cost. 120 of those ran within 150 km and 48 hours of one of Roadstar's own loads going to Ontario. Fairburn, Georgia to Atlanta is twenty miles. Same company, two trucks, one of them empty.
```

## How I built it

```
GLM 5.2 on SPUR Compute reads every offer. That is the surface the dispatcher touches, and it is the part regex is bad at and a language model is good at. Whether the load is legal is then settled in TypeScript against the cited regulation, because a model should never be the thing asserting what a statute permits.

The legality engine is 19 CFR 123.14, 49 CFR 395.3 and Canada's SOR/2005-313, each verified against two independent primary sources and tabulated in LEGAL.md. The border feed is CBP's public wait-time API, 15 crossings keyed by real port codes. Geocoding is an offline GeoNames gazetteer of 362,196 US and Canadian places, built with a script that handles the traps in their data: GeoNames keys Canadian provinces numerically, the TMS writes ST-MODESTE for Saint-Modeste, and "ONTARIO, CA" is California.

The backtest reads their Dispatch sheet directly. Ground truth for every headline number is theirs: which legs ran, how far, loaded or empty. The cost rate is ATRI's. None of the inputs are mine.

Then I measured what the sponsor's model contributes rather than asserting it. The same offers, rendered from real orders in five broker formats, are read twice: GLM 5.2 versus a fair rules parser with the model switched off. With the model, 100% reach the correct legal verdict. Without it, 40%.

Every number in the README is recomputed from the raw sheets by scripts/check_claims.py, which fails the build if the prose and the data disagree. It caught four mistakes in my own writeup the first time it ran. 31 tests lock the headline so a change to the geocoder cannot quietly move it.
```

## Challenges I ran into

```
The data corrected my thesis. I had built the pitch around trucks coming home empty, and Roadstar's own records showed six such legs in two months. The real finding, empty repositioning inside the US, is sharper and worth more, but it meant rewriting the story mid-build and deleting a dollar figure I had already computed because it measured something that does not happen.

Their null-date sentinel is 1980-01-01, and every empty repositioning leg carries it, because an empty leg has no customer expected-date. My first overlap analysis returned exactly zero matches and I nearly believed it.

GeoNames indexes Canadian places by numeric province code, so my first gazetteer had no Canada in it at all, silently dropping every Ontario lane. And GLM 5.2 has no clock: it dated every pickup 2024 until I told it what day it was.
```

## Accomplishments that I'm proud of

```
Finding 217 empty legs in a real carrier's history that were legally allowed to carry freight, and that nobody knew about, using a directional reading of a customs regulation that almost everyone treats as binary.

Reporting the result that went against me. The "come home empty" thesis was wrong and the correction is in the README, in the repo history, and in a script that fails if the old numbers ever come back.

An ablation instead of an assertion. 100% versus 40% is a number about the sponsor's product that the sponsor cannot easily produce for themselves.
```

## What I learned

```
Cabotage is directional, not binary, and the difference is worth six figures a quarter to one 82-truck carrier.

A refusal is the most memorable thing a tool can do, if it names what it just prevented.

Two independent implementations agreeing is worth more than one implementation with more tests. The Python analysis and the TypeScript engine compute the headline separately and match to the mile.
```

## What's next for Northbound

```
Real routing distances in place of the haversine-plus-circuity estimate. A rate per lane from the carrier's own invoices, so the amber verdict carries a dollar figure rather than a mileage one. Standing backhaul agreements on the lanes Roadstar repeats empty: Fairburn to Walton ten times, Scottsville to Walton eleven, Morris to Richmond thirteen. And the driver-facing half, where the border-crossing choice and the two-rulebook clock reach the person actually holding the wheel.
```

## Built with

```
typescript, node, glm-5.2, spur-compute, python, cbp-border-wait-times, geonames, vitest
```

---

## Notes (not for pasting)

- Tagline is 103 characters. Devpost's limit is generous, but the portal's may not be; check the field before pasting and trim to the first sentence if it truncates.
- "How I built it" names GLM 5.2 on SPUR four times and never describes it as doing the boring parts. That is deliberate.
- Every number above is one `check_claims.py` verifies. Run `npm run validate` before pasting.
- The ablation figures are from n = 100, recorded in `docs/ablation-n100.txt`, and locked by `check_claims.py`.
- Repo: https://github.com/JonathanSolvesProblems/northbound. Video URL to add once uploaded.
