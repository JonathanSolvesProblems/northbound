# Northbound

**Your truck already drove that lane. Empty. Northbound finds the freight it could legally have carried.**

A load board for Canadian cross-border carriers. It reads a freight offer the way it actually arrives, then answers the question a dispatcher cannot answer from a map: *is my Canadian truck allowed to haul this?*

Built for the RoadStar Hackathon 2026 on Roadstar Trucking's own dispatch data.

**Demo video (4:37):** https://www.youtube.com/watch?v=SZRIDo7swCA · **Project page:** https://jonathansolvesproblems.github.io/northbound/ · **Write-up:** https://jonathansolvesproblems.com/blog/northbound-canadian-cross-border-cabotage-load-board/

---

## What their data said

I started with a hypothesis: Ontario carriers haul into the US Midwest loaded and come home empty. **Their own records say that is wrong.** Across 10,479 completed legs, 1,596,093 miles, and about two months, 222,635 miles ran empty (13.9%):

| Where the empty miles are | Legs | Miles |
|---|---:|---:|
| Repositioning inside the US | 778 | **126,874** |
| Inside Canada | 2,847 | 65,738 |
| Crossing south empty | 92 | 27,979 |
| **Coming home empty** | **6** | **2,044** |

Roadstar is good at loading for home. Six empty legs in two months. The empty running is *between* US loads, and that turns out to be the interesting case, because whether those legs could have carried freight is a **legal** question, not a routing one.

### The headline

> **217 of those empty legs, 66,702 miles, were already travelling toward the border.**
> 19 CFR 123.14(c)(1) treats carriage "as part of the return of the vehicle to its base country" as incidental to international traffic, so those legs were legally allowed to carry freight.
> At ATRI's published 2025 industry cost of $2.336 per mile, that is **$155,815** of running that could have been paid for.

And it repeats, which means it is fixable with standing agreements rather than luck:

| Lane | Empty runs | Miles |
|---|---:|---:|
| Fairburn, GA → Walton, KY | 10 | 4,557 |
| Morris, IL → Richmond, IN | 13 | 3,565 |
| Scottsville, KY → Walton, KY | 11 | 2,173 |

### The part I did not expect

**120 times in two months, a Roadstar truck ran empty toward the border within 150 km and 48 hours of a Roadstar load heading to Ontario.**

```
Driver67 ran EMPTY  Fairburn, GA → Washington, IN   (476 mi, Jul 30)
   while bill 410487 for CSA TRANSPORTATION
   moved       Atlanta, GA → Etobicoke, ON          (Jul 29)
```

Fairburn is twenty miles from Atlanta. Same company, two trucks, one of them empty and legally able to carry. Every order in the book was hauled, so this is not lost revenue: it is a load assignment that could have gone the other way, and Northbound surfaces it at dispatch time instead of in a quarterly review.

---

## Cabotage is directional, and almost everyone treats it as binary

This is the whole engine.

A Canadian-domiciled truck may not haul US point-to-point freight. Every distance-based optimiser will happily offer it anyway. But the regulation is not a flat prohibition:

> **19 CFR 123.14(c)(1)** — carriage between US points is permitted where "incidental to the immediately prior or subsequent engagement of that vehicle in international traffic", and carriage "in the general direction of an export move or **as part of the return of the vehicle to its base country** shall be considered incidental."

So the customs test turns on **which way the load is going**:

| Move | Verdict |
|---|---|
| Columbus → Brampton | **Green.** International. |
| Columbus → Atlanta | **Red.** Moving away from home. |
| Columbus → Detroit | **Amber.** US domestic, but headed home. |

Amber exists because there is a second, stricter layer: the driver enters the US on B-1 admission, and that is more restrictive than the equipment rule. The two disagree on exactly one commercially interesting case, so Northbound surfaces it with both citations and hands the decision to the carrier's broker.

**This is not legal advice and Northbound does not present it as such.** It names the provision. A carrier confirms with their broker. Sources are in [`LEGAL.md`](LEGAL.md), verified against Cornell LII and govinfo independently.

---

## The clock changes at the bridge

A driver leaving Milton for Chicago runs under 49 CFR 395.3 south of the border and SOR/2005-313 north of it, and switches mid-trip. Roadstar's TMS already tracks both, in separate columns per driver. **88% of their drivers carry a materially different figure, mean gap 18.3 hours.**

```
Driver84   Corunna, MI → Guelph, ON
  hours    53.4h US cycle, 11.3h Canadian   LOSES 42.1h crossing
```

His board says 53 hours. He has 11 the moment he crosses.

Two details most planners get wrong, both in Northbound's favour:

- **Border wait never touches the driving limit.** It is on-duty-not-driving, so it costs the 14-hour window instead.
- **A wait of 30 minutes or more discharges the break the driver already owed**, because 395.3(a)(3)(ii) asks for an interruption in driving status rather than off-duty time.

---

## Where the model sits, and where it does not

The model **reads**. The law **decides**.

Freight arrives as email written in a hurry: *"Need a van, Columbus OH to Brampton ON, pu 9/12 0700-1200, 42k, $2650 all in"*. Extracting that is what a language model is genuinely good at and what regex is bad at. Whether the truck may legally take it is then settled in code, against a cited provision.

A model should never be the thing asserting what a regulation permits.

Runs on SPUR Compute (the event's AI sponsor), GLM 5.2, through an OpenAI-compatible endpoint.

### What the model actually contributes, measured

Every entry at a sponsored hackathon says the sponsor's product was essential. This measures it. The same offers are read twice, once by GLM 5.2 on SPUR and once by a genuine rules parser with the model switched off. Ground truth is Roadstar's own order book. Both arms see byte-identical text.

| | GLM 5.2 | no model |
|---|---:|---:|
| origin + destination read correctly | 100% | 40% |
| weight | 81% | 61% |
| **correct legal verdict reached** | **100%** | **40%** |

The regex arm is a fair opponent, not a strawman. It matches the model on structured formats (header blocks, formal email) and fails completely on the three informal formats freight actually arrives in: trader shorthand, chat messages, forwarded chains. That is where the model earns its place.

`npx tsx src/cli/ablation.ts 100` reproduces it. n = 100, zero read failures, run recorded in `docs/ablation-n100.txt`.

### The refusal is the point

```
RED  ·  Not available to this truck.
   Domestic US move that does not carry the truck toward its base country.
   The $2,100 on offer is not worth it. Taking it is the cabotage violation
   19 CFR 123.14(d) warns of: liabilities under section 592 of the Tariff Act
   of 1930, and the driver's B-1 admission at risk on his next entry.
```

A load board that only ever says yes is a load board that will eventually get a driver turned around at the bridge. Northbound says no, names the provision, and names the exposure.

### The prose cannot drift from the data

`scripts/check_claims.py` recomputes every headline number in this README from the raw sheets and fails the build if any is absent or different. It also carries a list of every figure this project produced and then superseded (this build corrected its own thesis twice) and fails if one reappears. On its first run it caught four problems. `npm run validate` runs typecheck, tests, and this check together.

---

## Running it

**The carrier data is deliberately not in this repo.** It is Roadstar's operational
record, provided to participants for the hackathon, and it is not mine to publish.
To reproduce every number below, put the workbook from the participant portal at
`data/raw/Hackathon_Data.xlsx` and extract its sheets:

```bash
npm install
cp .env.example .env          # add your SPUR_API_KEY
python scripts/extract_sheets.py    # xlsx -> data/raw/sheets/*.csv
```

Then:

```bash
npx tsx src/cli/board.ts      # live dispatch board, real trucks, live CBP waits
npx tsx src/cli/offer.ts --driver Driver67 "van, Fairburn GA to Walton KY, pu 9/12, 42k, \$1450"
npx tsx src/cli/ablation.ts 30    # what the model contributes, measured

npm run validate              # typecheck + 31 tests + check_claims
python scripts/empty_miles.py     # empty running, by direction
python scripts/fillable.py        # the headline number
python scripts/overlap.py         # empty trucks beside their own freight
```

`data/ref/gazetteer.json` is committed so a clean clone works immediately. To
rebuild it from source (about 80 MB of GeoNames downloads):

```bash
python scripts/build_gazetteer.py
```

---

## Who graded the numbers

Not me. That is the point.

| Input | Source |
|---|---|
| Which legs ran, how far, loaded or empty | Roadstar's own `Dispatch` sheet |
| Truck positions and dual-clock hours | Roadstar's own `Driver` sheet |
| Border wait times, commercial and FAST lanes | [CBP, live](https://bwt.cbp.gov/api/waittimes) |
| What counts as heading home | [19 CFR 123.14(c)(1)](https://www.law.cornell.edu/cfr/text/19/123.14), verified against [govinfo](https://www.govinfo.gov/content/pkg/CFR-2023-title19-vol1/xml/CFR-2023-title19-vol1-sec123-14.xml) |
| Hours of service | [49 CFR 395.3](https://www.law.cornell.edu/cfr/text/49/395.3) · [SOR/2005-313](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/) |
| Cost per mile | ATRI, [*An Analysis of the Operational Costs of Trucking*, 2026 edition](https://truckingresearch.org/2026/07/new-atri-report-details-accelerating-costs-and-low-profitability-despite-cuts/), reporting 2025 costs |
| City coordinates | [GeoNames](https://download.geonames.org/export/dump/) |

The headline is locked behind tests. If a change to the geocoder moves it, the suite fails rather than letting the pitch drift away from the data.

---

## Honest limitations

- **The window is about two months** (2026-06-26 to 2026-08-28). The figures are not annualised, because seasonality would make that a softer number pretending to be a harder one.
- **The 150 km / 48 h thresholds in the overlap analysis are mine.** The sensitivity table is in [`PHASE0.md`](PHASE0.md) rather than a single tuned figure. At the most conservative corner, 50 km and 12 hours, it is still 30 legs and $16,000.
- **98.4% of orders geocode.** The remaining 65 are typos in the source data (`OLIVHURST`, `NOGALAS`) and are reported, never silently dropped.
- **The B-1 driver restriction is corroborated but its primary source is not machine-readable.** Nothing turns on the exact wording, because that exposure is why the directional case is amber rather than green.
- **Distances use haversine with a 1.2 highway circuity factor**, not real routing. Adequate for choosing a crossing and a direction. Not adequate for a mileage invoice, and not used for one.
- **The HOS state is built from cycle hours remaining, not a full duty log.** Enough to rank a board. Not enough to certify a logbook.
