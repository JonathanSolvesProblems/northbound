# Pre-submit gate

Deadline: **Sunday 13 September 2026, 12:00 EDT** (Devpost). Remote submission, no live presentation.

Run every row before pasting anything. A failed check is worth more than any remaining feature.

## Checks

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | Headline number exists as a number | **PASS** | 217 legs / 66,702 miles / $155,815. Locked by `src/analysis/history.test.ts` and `scripts/check_claims.py`. |
| 2 | Demo runs on real evidence, nothing seeded | **PASS** | `grep -rniE "seed\|fixture\|stub\|mock"` over `src/` and `scripts/` returns nothing outside tests. Every b-roll clip is a real command on the real workbook, with the raw `.txt` beside it. |
| 3 | Every form field proofread rendered, logged out | pending | Do after paste. Private window. Read the tagline aloud. |
| 4 | Drafting file contains only final values | **PASS** | `SUBMISSION.md`: one fenced block per field, notes below every field. |
| 5 | Public-access check, logged out | **PASS** for repo and page | Repo HTTP 200, page HTTP 200, OG image HTTP 200, clean clone runs `npm run validate`. Video and gallery pending. Gallery unpublished so far, which is ordinary. |
| 6 | Deliverables, each named and located | see below | |
| 7 | Headline traces to the technology credited | **PASS** | Headline credited to Dispatch sheet + GeoNames + 19 CFR + ATRI, which produced it. GLM 5.2 credited for offer reading, and the ablation (n = 100) measures exactly that. |
| 8 | The name's promise is visible in the demo | **PASS** | "Northbound" promises a load home for a Canadian truck. Shots 05, 06, 07 and the page's headline sign are that. The page is literally a northbound guide sign. |

## Hackathon design gate (from the UI skill)

| Check | Status |
|---|---|
| The one screen is legible at 1280x720 | **PASS**, `broll/_site-1280-*.png` |
| Headline number visible, real, uneven, world unit | **PASS**, the destination list |
| First screen after load is designed | **PASS**, the sign, not a login wall |
| Demo runs on real data, live path is the opening shot | **PASS** |
| Three screenshots that make sense alone | **PASS**, `docs/media/shots/` |
| OG image and favicon exist | **PASS**, both HTTP 200 |
| Visual identity a judge can name in one clause | **PASS**, "the green highway sign one" |

## Deliverables

| Item | Required by | Location | Status |
|---|---|---|---|
| Code, frozen | rules | https://github.com/JonathanSolvesProblems/northbound | **done**, public |
| Project page | nice to have | https://jonathansolvesproblems.github.io/northbound/ | **done**, live |
| Demo video, 3 to 5 min | rules | 16 clips in `broll/`, script in `DEMO.md` | **narration pending** (only Jonathan's voice) |
| Live presentation, 10 to 15 min | rules | not attending; Corey emailed 10 Sep to confirm remote judging | **answer pending** |
| Devpost submission | Devpost | `broll/submission.md` (form-shaped), `broll/thumbnail-3x2.png`, `docs/media/shots/` | paste pending |
| Portal submission | portal Submissions tab | unknown fields, check before Sunday | check pending |

## Before paste, in order

1. `npm run validate` green.
2. Record narration from `DEMO.md`. Assemble: `vidkit assemble narration.mp3 --clips-dir broll --out demo.mp4`, or any editor with clips in numerical order.
3. Upload the video. Confirm it plays logged out.
4. Paste `broll/submission.md` field by field. It is shaped like the Devpost form: name, pitch, one story block, tags, links. Upload `broll/thumbnail-3x2.png` and the four images in `docs/media/shots/`.
5. Open the live submission page in a private window. Read the tagline aloud.
6. Screenshot the confirmation.
7. If the gallery is published, search it for "Northbound".

## After judging closes

Nothing to tear down: no servers, no DNS, no cloud resources. GitHub Pages is free and stays up. Revoke the SPUR key once results are in.
