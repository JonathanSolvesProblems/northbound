# Pre-submit gate

Deadline: **Sunday 13 September 2026, 12:00 EDT** (Devpost). Remote submission, no live presentation.

Run every row before pasting anything. A failed check is worth more than any remaining feature.

## Checks

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | Headline number exists as a number | **PASS** | 217 legs / 66,702 miles / $155,815. Locked by `src/analysis/history.test.ts`. |
| 2 | Demo runs on real evidence, nothing seeded | **PASS** | `grep -rniE "seed\|fixture\|stub\|mock"` over `src/` and `scripts/` returns nothing outside tests. Every screen in `DEMO.md` is a real command on the real workbook. |
| 3 | Every form field proofread rendered, logged out | pending | Do after paste. Open the live page in a private window. Read the tagline aloud. |
| 4 | Drafting file contains only final values | **PASS** | `SUBMISSION.md`: one fenced block per field, notes below every field. |
| 5 | Public-access check, logged out | pending | Repo public, video plays, page loads, clean clone runs `npm run validate`. Then search the gallery by name **if the gallery is published**; if it is not, that is ordinary and not a risk. |
| 6 | Deliverables, each named and located | see below | |
| 7 | Headline traces to the technology credited | **PASS** | Headline is credited to Dispatch sheet + GeoNames + 19 CFR + ATRI, which is what produced it. GLM 5.2 is credited for offer reading, and the ablation measures exactly that. No misattribution in either direction. |
| 8 | The name's promise is visible in the demo | **PASS** | "Northbound" promises a load home for a Canadian truck. Shots 5, 6 and 7 are that. |

## Deliverables

| Item | Required by | Location | Status |
|---|---|---|---|
| Code, frozen | rules | public repo | **push pending** |
| Demo video, 3 to 5 min | rules | script in `DEMO.md`, recording pending | **record pending** |
| Live presentation, 10 to 15 min | rules | not attending; organizer emailed 10 Sep to confirm remote judging | **answer pending** |
| Devpost submission | Devpost | `SUBMISSION.md` fields | paste pending |
| Portal submission | portal Submissions tab | unknown fields, check before Sunday | check pending |

## Before paste, in order

1. `npm run validate` green.
2. `PYTHONIOENCODING=utf-8 python scripts/check_claims.py` says PASS.
3. If the n = 100 ablation changed the figures, update README, PHASE0 and SUBMISSION together, re-run step 2.
4. Push. Confirm the repo is public from a logged-out browser.
5. Record the video from `DEMO.md`. Upload. Confirm it plays logged out.
6. Paste `SUBMISSION.md` fields. Add repo and video links.
7. Open the live submission page in a private window. Read the tagline aloud.
8. Screenshot the confirmation.

## After judging closes

Nothing to tear down. No servers, no DNS, no cloud resources. Revoke the SPUR key once the results are in.
