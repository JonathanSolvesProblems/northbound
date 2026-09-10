# The legality engine: verified sources

Every rule Northbound enforces traces to a primary source quoted here. The standard comes from the law, not from this repository. That is deliberate: it is what makes the headline number externally graded.

**This is not legal advice and Northbound does not present it as such.** The product's job is to surface the load and name the provision. A carrier confirms with their customs broker. Saying so plainly is more credible to an industry judge than pretending to be counsel, and it is honest.

---

## Layer 1: the equipment (customs)

**19 CFR 123.14 — Entry of foreign-based trucks, busses, and taxicabs.**

**Verified twice, against two independent sources: Cornell LII and govinfo.gov (CFR-2023-title19-vol1-sec123-14).** The operative sentence in (c)(1) is identical in both. This is the claim the whole product rests on, so it got a second read rather than one.

- **(a)** Foreign-based trucks may be "admitted without formal entry or the payment of duty" but "shall not engage in local traffic except as provided in paragraph (c)."

- **(c)(1)** The vehicle may carry merchandise between US points where "such carriage is incidental to the immediately prior or subsequent engagement of that vehicle in international traffic." Critically, carriage **"in the general direction of an export move or as part of the return of the vehicle to its base country shall be considered incidental."**

- **(c)(2)** A "foreign-based truck trailer may carry merchandise between points in the United States on its departure for a foreign country," on conditions matching those for foreign railroad equipment.

- **(d)** Improper use "may result in liabilities being incurred under section 592, Tariff Act of 1930."

**What (c)(1) actually means.** The customs test is directional. A US-domestic move is permitted for the *equipment* when it carries the truck home toward Canada. Columbus to Atlanta fails. Columbus to Detroit is, on the customs side, incidental to the return.

## Layer 2: the driver (immigration)

Separate body of law, and it is **more restrictive than layer 1.**

A Canadian driver enters the US as a B-1 business visitor. B-1 drivers may move freight that is in transit to or from another country. They may **not** take a load moving between two US points before returning home, "irrespective of who employs them."

Sources so far are CBP and DHS guidance plus practitioner commentary (Benesch, DHS cross-border trucking guidelines, CBP's May 2025 CTPAT alert on cabotage violations). CBP enforcement against B-1 cabotage has been increasing, and violations can put a carrier's CTPAT status at risk.

**Status: corroborated across several sources, primary not yet read directly.** DHS cross-border trucking guidelines and practitioner commentary (Benesch, Melton) agree, and CBP's May 2025 CTPAT alert on cabotage violations exists but is a 480 KB PDF that did not extract to text here. Nothing in the product turns on the exact wording, because B-1 exposure is the reason the directional case is AMBER rather than GREEN, and AMBER already routes the decision to a broker. Worth a direct read before the writeup ships:
https://www.cbp.gov/sites/default/files/2025-09/ctpat_alert_-_cabotage_rules_violations_and_ctpat_-_may_20_2025_508.pdf

## The conflict, and how Northbound handles it

The two layers disagree on exactly one case, and it is the commercially interesting one.

| Case | Customs (123.14) | Driver (B-1) | Northbound |
|---|---|---|---|
| US load terminating in Canada | International, fine | International, fine | **Green.** The core backhaul. |
| Empty repositioning toward home | Fine | Fine | Green, but earns nothing. |
| US domestic, moving away from the border | Not incidental. Prohibited. | Prohibited | **Red.** Never shown as available. |
| US domestic, in the general direction of home | Permitted as incidental under (c)(1) | The exposure sits here | **Amber.** Surfaced with both citations and the revenue attached, marked as a broker call. |

The conservative practice most Canadian carriers actually follow is to decline the amber case outright, because an immigration refusal against a driver is worse than a customs penalty. Northbound does not overrule that. It shows the money and names the provision so the decision is informed rather than reflexive.

**Naming discipline:** amber is never rendered as a violation warning. It is a load with a footnote.

---

## Layer 3: hours of service, two rulesets on one trip

A driver running Milton to Chicago changes ruleset at the border. Northbound plans both halves.

### United States — 49 CFR 395.3 (property-carrying)

| Provision | Rule |
|---|---|
| (a)(1) | No driving without first taking 10 consecutive hours off duty |
| (a)(2) | No driving after a period of 14 consecutive hours after coming on duty |
| (a)(3)(i) | Maximum 11 hours driving within that 14-hour window |
| (a)(3)(ii) | No driving if more than 8 hours of driving time have passed without a consecutive 30-minute interruption |
| (b)(1) | 60 hours on duty in any 7 consecutive days (carrier not operating every day) |
| (b)(2) | 70 hours on duty in any 8 consecutive days (carrier operating every day) |
| (c) | Either period may restart with 34 or more consecutive hours off duty |

### Canada — SOR/2005-313, south of latitude 60°N

| Provision | Rule |
|---|---|
| s. 12 | Maximum 13 hours driving time, maximum 14 hours on-duty time |
| s. 13 | After 13 driving / 14 on-duty, at least 8 consecutive hours off duty before driving again |
| s. 14 | At least 10 hours off-duty time in a day |
| s. 18(1)(e) | No driving after the 16th hour following coming on duty (elapsed-time rule) |
| s. 26 | Cycle 1: 70 hours on duty in any 7 days |
| s. 27 | Cycle 2: 120 hours on duty in any 14 days, and not past 70 without 24 consecutive hours off |

### The 30-minute break, and why the border wait pays for it

**Verified.** 49 CFR 395.3(a)(3)(ii) requires "a consecutive 30-minute interruption in driving status", not off-duty time. Under the HOS final rule published 1 June 2020 and effective 29 September 2020, that interruption may be satisfied by off-duty, sleeper berth, **or on-duty-not-driving** time, or a combination.

Waiting in a commercial queue is on-duty-not-driving. So a border wait of 30 minutes or more discharges the break the driver already owed. Northbound models this, and it is the reason a long wait is not pure loss.

### The border switch

Operating rule the engine uses: a driver complies with the rules of the jurisdiction they are operating in, so US limits bind the US portion and Canadian limits bind the Canadian portion, with on-duty time accumulated across the whole trip counting toward both cycles.

**Status: the precise reciprocity mechanism still needs one verification pass** before it is stated as fact in the writeup. The practical effect is not in doubt, and Roadstar's own TMS carries `REMAINING_HOURS_US_7/8` and `REMAINING_HOURS_CAN_7/8/14` as separate columns per driver, which is the strongest possible evidence that a real cross-border carrier tracks two clocks. But the wording must be right before it ships.

---

## Layer 4: the border clock

**CBP Border Wait Times, `https://bwt.cbp.gov/api/waittimes`.** Public JSON, no key, no auth. Verified live on 2026-09-09: HTTP 200, 95 KB, 85 ports, of which 30 are Canadian-border ports carrying commercial lanes.

Per port the feed gives `commercial_vehicle_lanes` split into `standard_lanes` and `FAST_lanes`, each with `delay_minutes`, `operational_status`, `lanes_open` and `update_time`, plus `port_status` and operating `hours`.

This matters because delay minutes come straight off the driver's 11-hour clock, and because FAST versus standard is a real dispatch decision. Observed in the same snapshot: Ambassador Bridge standard 5 min with FAST at 0, Gordie Howe standard 0 with **FAST lanes closed**, Lewiston Bridge standard 16 min.

The feed is a genuine external grader. I do not author it and cannot influence it.

---

## Citation discipline

Nothing in this file goes into the writeup, the demo, or the UI until it has been read against its primary source. Two items above are explicitly marked as needing another pass. Where a claim cannot be verified in time, it gets cut rather than softened.
