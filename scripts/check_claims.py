"""Fail if the prose and the data disagree.

Every number a judge could repeat out of README.md or PHASE0.md is recomputed here
from the raw dispatch and order data, then checked against the documents. Two ways
to fail:

  1. A current number is absent from the docs, or the docs carry a different value.
  2. A RETIRED number reappears. This build corrected its own thesis twice, and each
     correction left superseded figures behind. They are listed below by name so a
     stale paste cannot quietly resurrect one.

Run: python scripts/check_claims.py      (exit 1 on any disagreement)

This is deliberately independent of src/analysis/history.ts, which computes the same
numbers in TypeScript. Two implementations agreeing is the check.
"""
import csv, math, os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from geocode import geocode, geocode_desc, country_of  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
DOCS = [os.path.join(ROOT, 'README.md'), os.path.join(ROOT, 'PHASE0.md')]
DISPATCH = os.path.join(ROOT, 'data', 'raw', 'sheets', 'dispatch.csv')
DRIVERS = os.path.join(ROOT, 'data', 'raw', 'sheets', 'driver.csv')

NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}
ATRI = 2.336
MIN_PROGRESS_KM = 25

CROSSINGS = [
    (42.3120, -83.0733), (42.2925, -83.1085), (42.9997, -82.4223), (42.9053, -78.9060),
    (43.1637, -79.0430), (44.3350, -75.9930), (46.5100, -84.3480), (44.9861, -74.7369),
    (44.7136, -75.4586), (48.6019, -93.4069), (48.9436, -97.2408), (48.9986, -111.9633),
    (49.0025, -122.7375), (49.0025, -122.4847), (49.0025, -122.2647),
]


def v(r, k):
    x = (r.get(k) or '').strip()
    return None if x in NULLS else x


def num(r, k):
    try:
        return float(v(r, k))
    except (TypeError, ValueError):
        return 0.0


def hav(a, b):
    R = 6371.0088
    dlat = math.radians(b[0] - a[0]); dlon = math.radians(b[1] - a[1])
    h = math.sin(dlat/2)**2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlon/2)**2
    return 2 * R * math.asin(min(1, math.sqrt(h)))


def border_km(p):
    return min(hav(p, c) for c in CROSSINGS)


# ---------------------------------------------------------------- recompute
def compute():
    rows = list(csv.DictReader(open(DISPATCH, newline='', encoding='utf-8', errors='replace')))
    loaded = empty = 0
    loaded_mi = empty_mi = 0.0
    lanes = defaultdict(lambda: [0, 0.0])
    border_bound = []
    repeat = defaultdict(int)

    for r in rows:
        mi = num(r, 'LS_LEG_DIST')
        is_empty = (v(r, 'LS_MT_LOADED') or '').upper() == 'E'
        if is_empty:
            empty += 1; empty_mi += mi
        else:
            loaded += 1; loaded_mi += mi
        if not is_empty:
            continue
        o_desc, d_desc = v(r, 'LEGO_ZONE_DESC'), v(r, 'LEGD_ZONE_DESC')
        oc, dc = country_of(o_desc), country_of(d_desc)
        lanes[f'{oc}->{dc}'][0] += 1
        lanes[f'{oc}->{dc}'][1] += mi
        if oc == 'US' and dc == 'US':
            o, d = geocode_desc(o_desc), geocode_desc(d_desc)
            if o and d and border_km(o) - border_km(d) >= MIN_PROGRESS_KM:
                border_bound.append(mi)
                repeat[f'{o_desc} -> {d_desc}'] += 1

    drivers = [r for r in csv.DictReader(open(DRIVERS, newline='', encoding='utf-8', errors='replace')) if v(r, 'DRIVER_ID')]
    gaps = []
    for r in drivers:
        us, ca = v(r, 'REMAINING_HOURS_US_7'), v(r, 'REMAINING_HOURS_CAN_7')
        if us and ca:
            gaps.append(abs(float(ca) - float(us)))
    material = sum(1 for g in gaps if g >= 1)

    bb_mi = sum(border_bound)
    total_mi = loaded_mi + empty_mi
    return {
        'legs': loaded + empty,
        'total_miles': round(total_mi),
        'empty_miles': round(empty_mi),
        'empty_share_pct': round(empty_mi / total_mi * 100, 1),
        'home_empty_legs': lanes['US->CA'][0],
        'home_empty_miles': round(lanes['US->CA'][1]),
        'usus_legs': lanes['US->US'][0],
        'usus_miles': round(lanes['US->US'][1]),
        'border_bound_legs': len(border_bound),
        'border_bound_miles': round(bb_mi),
        'border_bound_cost': round(bb_mi * ATRI),
        'fairburn_runs': repeat.get('FAIRBURN, GA -> WALTON,KY', 0),
        'morris_runs': repeat.get('MORRIS, IL -> RICHMOND, IN', 0),
        'scottsville_runs': repeat.get('SCOTTSVILLE, KY -> WALTON,KY', 0),
        'dual_clock_pct': round(material / len(gaps) * 100),
        'dual_clock_mean_gap': round(sum(gaps) / len(gaps), 1),
    }


# ---------------------------------------------------------------- claims
def fmt(n):
    return f'{n:,}' if isinstance(n, int) else str(n)


def expected_strings(c):
    """Each current claim, as the exact text a doc must contain."""
    return {
        'completed legs':            fmt(c['legs']),
        'total miles':               fmt(c['total_miles']),
        'empty miles':               fmt(c['empty_miles']),
        'empty share':               f"{c['empty_share_pct']}%",
        # Both docs state this as a table row, so check the row rather than prose.
        'home-empty legs + miles':   f"| **{c['home_empty_legs']}** | **{fmt(c['home_empty_miles'])}** |",
        'US-to-US empty legs':       fmt(c['usus_legs']),
        'US-to-US empty miles':      fmt(c['usus_miles']),
        'border-bound legs':         f"{c['border_bound_legs']} ",
        'border-bound miles':        fmt(c['border_bound_miles']),
        'border-bound cost':         f"${fmt(c['border_bound_cost'])}",
        'Fairburn repeat count':     f"| {c['fairburn_runs']} |",
        'Morris repeat count':       f"| {c['morris_runs']} |",
        'Scottsville repeat count':  f"| {c['scottsville_runs']} |",
        'dual-clock share':          f"{c['dual_clock_pct']}%",
        'dual-clock mean gap':       f"{c['dual_clock_mean_gap']} hours",
    }


# Figures this build produced and then superseded. If any of these come back, the
# docs have regressed to an earlier, wrong version of the story.
RETIRED = {
    '$56,146':   'projected exposure if trucks ran home empty; deleted, their history says they do not',
    '24,035':    'miles for the deleted exposure figure',
    '38,681':    'km for the deleted exposure figure',
    '213 ':      'border-bound legs before the gazetteer handled Canadian provinces',
    '64,930':    'border-bound miles, pre-gazetteer-fix',
    '$151,678':  'border-bound cost, pre-gazetteer-fix',
    '42.0%':     'BTS gateway share with Buffalo mis-keyed; correct figure is 58.5%',
    '2,165,074': 'BTS gateway sum with Buffalo mis-keyed',
    'gets it home': 'the original pitch, retired when the data showed they already load for home',
}


def main() -> int:
    c = compute()
    docs = {p: open(p, encoding='utf-8').read() for p in DOCS}
    failures = []

    print('Recomputed from data/raw/sheets:')
    for k, val in c.items():
        print(f'  {k:<24} {fmt(val)}')
    print()

    for label, needle in expected_strings(c).items():
        hit = [os.path.basename(p) for p, t in docs.items() if needle in t]
        if hit:
            print(f'  ok      {label:<26} "{needle}"  in {", ".join(hit)}')
        else:
            failures.append(f'MISSING  {label}: expected "{needle}" in the docs')
            print(f'  MISSING {label:<26} "{needle}"')

    print()
    for needle, why in RETIRED.items():
        hit = [os.path.basename(p) for p, t in docs.items() if needle in t]
        if hit:
            # Allow it only inside a line that explicitly marks it as superseded.
            ok = all(
                all(('superseded' in ln.lower() or 'retired' in ln.lower() or 'deleted' in ln.lower()
                     or 'wrong' in ln.lower() or 'corrected' in ln.lower() or 'mis-keyed' in ln.lower()
                     or 'original pitch' in ln.lower() or 'earlier' in ln.lower())
                    for ln in t.splitlines() if needle in ln)
                for p, t in docs.items() if needle in t
            )
            if ok:
                print(f'  ok      retired "{needle}" appears only where marked as superseded')
            else:
                failures.append(f'RETIRED  "{needle}" reappears unmarked in {", ".join(hit)}: {why}')
                print(f'  RETIRED "{needle}" reappears in {", ".join(hit)}')

    print()
    if failures:
        print(f'FAIL: {len(failures)} disagreement(s) between the prose and the data.')
        for f in failures:
            print('  -', f)
        return 1
    print('PASS: every headline number in the docs matches the data, and no retired claim reappears.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
