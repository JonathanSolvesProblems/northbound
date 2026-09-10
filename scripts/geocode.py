"""Shared place lookup, so every analysis geocodes identically.

Backed by GeoNames (US + CA populated places, ascii and alternate names, indexed
CITY,STATE with the most-populous match winning). Build it with:

    python scripts/build_gazetteer.py

Roadstar's TMS writes place names the way dispatchers type them, so the raw key
misses a lot: "ST-MODESTE" against GeoNames' "Saint-Modeste", "NORTH YORK" for a
district GeoNames files under Toronto. The candidate ladder below closes that gap
and every remaining miss is reported by the callers rather than dropped silently.
"""
import json, os

_HERE = os.path.dirname(__file__)
GAZ = json.load(open(os.path.join(_HERE, '..', 'data', 'ref', 'gazetteer.json')))

CA_PROV = {'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'}

# Amalgamated Toronto districts and similar. Using the parent city is fine here:
# these analyses only ask which direction a lane runs, at hundred-kilometre scale.
DISTRICTS = {
    'NORTHYORK,ON': 'TORONTO,ON',
    'SCARBOROUGH,ON': 'TORONTO,ON',
    'ETOBICOKE,ON': 'TORONTO,ON',
    'EASTYORK,ON': 'TORONTO,ON',
    'YORK,ON': 'TORONTO,ON',
    'CONCORD,ON': 'VAUGHAN,ON',
    'REXDALE,ON': 'TORONTO,ON',
    'WESTON,ON': 'TORONTO,ON',
    'AGINCOURT,ON': 'TORONTO,ON',
}

_PREFIX = [('ST', 'SAINT'), ('SAINT', 'ST'), ('STE', 'SAINTE'), ('SAINTE', 'STE'), ('MT', 'MOUNT'), ('MOUNT', 'MT')]

# Michigan and Ontario freight addresses are full of civil townships that GeoNames
# files under the bare place name.
_SUFFIX = (' TOWNSHIP', ' TWP', ' TOWN', ' VILLAGE', ' CITY OF', ' TOWN OF')

# PQ is the obsolete code for Quebec and still appears in older TMS records.
_STATE_ALIAS = {'PQ': 'QC', 'NF': 'NL'}


def _squash(s: str) -> str:
    return s.upper().replace(' ', '').replace('-', '').replace('.', '').replace("'", '')


def _variants(raw: str) -> list:
    """Name forms to try, in order, before giving up on a place."""
    forms = [raw]
    for suf in _SUFFIX:
        if raw.endswith(suf):
            forms.append(raw[: -len(suf)].strip())
    out = []
    for form in forms:
        out.append(_squash(form))
        tokens = form.replace('-', ' ').replace('.', '').split()
        if tokens:
            for a, b in _PREFIX:
                if tokens[0] == a:
                    out.append(_squash(' '.join([b] + tokens[1:])))
    return out


def _candidates(city: str) -> list:
    return _variants(city.strip().upper())


def geocode(city, state):
    """('ST-MODESTE', 'QC') -> (lat, lon), or None if genuinely not found."""
    if not city or not state:
        return None
    st = state.strip().upper()[:2]
    st = _STATE_ALIAS.get(st, st)
    for cand in _candidates(city):
        key = f'{cand},{st}'
        key = DISTRICTS.get(key, key)
        hit = GAZ.get(key)
        if hit:
            return tuple(hit)
    return None


def geocode_desc(desc):
    """'NORWALK, OH' -> (lat, lon). The format the Dispatch sheet uses."""
    if not desc or ',' not in desc:
        return None
    city, state = desc.rsplit(',', 1)
    return geocode(city, state)


def country_of(desc):
    """'MILTON, ON' -> 'CA'. Trust the code rather than guessing from geometry."""
    if not desc or ',' not in desc:
        return None
    code = desc.rsplit(',', 1)[1].strip().upper()[:2]
    if not code.isalpha():
        return None
    return 'CA' if code in CA_PROV else 'US'
