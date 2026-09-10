"""Build the offline city gazetteer from GeoNames.

Downloads the US and Canada populated-place dumps plus the admin1 code table, and
writes data/ref/gazetteer.json as CITY,STATE -> [lat, lon], most populous winning.

Two traps this exists to handle:

  * GeoNames keys Canadian places by NUMERIC admin1 codes ("08" is Ontario), not by
    province code. Indexing naively produces a gazetteer with no Canada in it, which
    silently drops every Ontario lane.
  * Alternate names matter. Roadstar's TMS writes "ST-MODESTE" where GeoNames has
    "Saint-Modeste", so both the ascii name and the alternate names are indexed.

Run: python scripts/build_gazetteer.py   (about 80 MB of downloads, once)
"""
import json, os, sys, urllib.request, zipfile

REF = os.path.join(os.path.dirname(__file__), '..', 'data', 'ref')
BASE = 'https://download.geonames.org/export/dump'

PROV_BY_NAME = {
    'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Northwest Territories': 'NT',
    'Nunavut': 'NU', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC',
    'Saskatchewan': 'SK', 'Yukon': 'YT',
}


def fetch(name: str) -> str:
    os.makedirs(REF, exist_ok=True)
    dest = os.path.join(REF, name)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        print(f'  {name} already present, skipping download')
        return dest
    print(f'  downloading {name} ...', flush=True)
    urllib.request.urlretrieve(f'{BASE}/{name}', dest)
    return dest


def canadian_admin1(path: str) -> dict:
    out = {}
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 2 or not parts[0].startswith('CA.'):
                continue
            if parts[1] in PROV_BY_NAME:
                out[parts[0].split('.', 1)[1]] = PROV_BY_NAME[parts[1]]
    return out


def main() -> int:
    print('Building gazetteer from GeoNames')
    admin1_path = fetch('admin1CodesASCII.txt')
    ca_admin = canadian_admin1(admin1_path)
    print(f'  {len(ca_admin)} Canadian provinces mapped from numeric admin1 codes')

    index: dict = {}
    for cc in ('US', 'CA'):
        path = fetch(f'{cc}.zip')
        kept = 0
        with zipfile.ZipFile(path) as z, z.open(f'{cc}.txt') as fh:
            for raw in fh:
                p = raw.decode('utf-8', 'replace').rstrip('\n').split('\t')
                if len(p) < 15 or p[6] != 'P':      # P = populated place
                    continue
                admin1 = p[10].strip()
                state = ca_admin.get(admin1) if cc == 'CA' else admin1.upper()
                if not state or len(state) != 2:
                    continue
                try:
                    pop = int(p[14]) if p[14] else 0
                except ValueError:
                    pop = 0
                lat, lon = float(p[4]), float(p[5])
                names = {p[2]} | {n for n in p[3].split(',') if n and n.isascii()}
                for nm in names:
                    key = f'{nm.upper().replace(" ", "").replace("-", "")},{state}'
                    prev = index.get(key)
                    if prev is None or pop > prev[2]:
                        index[key] = (lat, lon, pop)
                kept += 1
        print(f'  {cc}: {kept:,} populated places')

    out = os.path.join(REF, 'gazetteer.json')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump({k: [v[0], v[1]] for k, v in index.items()}, fh)
    print(f'\n{len(index):,} keys written to {out}')

    missing = [k for k in ('MILTON,ON', 'WHITBY,ON', 'ROMULUS,MI', 'SAINTMODESTE,QC', 'NORWALK,OH') if k not in index]
    if missing:
        print(f'WARNING: expected keys absent: {missing}')
        return 1
    print('Spot checks passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
