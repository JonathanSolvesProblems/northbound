/**
 * Every delivery city that appears in Roadstar's board, with an approximate
 * centroid.
 *
 * Coordinates are city centroids to roughly a kilometre. That is ample for
 * choosing a border crossing and for deciding whether a load runs toward or away
 * from Canada, both of which are hundred-kilometre judgements. It is not good
 * enough for a mileage invoice, and Northbound does not use it for one.
 *
 * A geocoder would replace this file. It would also be a network dependency in
 * the middle of a live demo, so for now the gazetteer is checked in.
 *
 * Note "ONTARIO, CA" is Ontario, California, the Inland Empire warehouse hub, not
 * Ontario Canada. Roadstar delivers there regularly. Getting this wrong would
 * route a truck to Windsor instead of the far side of the continent.
 */

import type { Country, LatLon } from '../legal/geo';

export interface Place {
  at: LatLon;
  country: Country;
}

export const PLACES: Record<string, Place> = {
  // Ontario and Quebec
  'MILTON,ON': { at: { lat: 43.5183, lon: -79.8774 }, country: 'CA' },
  'WHITBY,ON': { at: { lat: 43.8975, lon: -78.9428 }, country: 'CA' },
  'LONDON,ON': { at: { lat: 42.9849, lon: -81.2453 }, country: 'CA' },
  'GUELPH,ON': { at: { lat: 43.5448, lon: -80.2482 }, country: 'CA' },
  'VAUGHAN,ON': { at: { lat: 43.8361, lon: -79.4983 }, country: 'CA' },
  'STONEYCREEK,ON': { at: { lat: 43.2168, lon: -79.7624 }, country: 'CA' },
  'BARRIE,ON': { at: { lat: 44.3894, lon: -79.6903 }, country: 'CA' },
  'KITCHENER,ON': { at: { lat: 43.4516, lon: -80.4925 }, country: 'CA' },
  'OSHAWA,ON': { at: { lat: 43.8971, lon: -78.8658 }, country: 'CA' },
  'HALTONHILLS,ON': { at: { lat: 43.6303, lon: -79.949 }, country: 'CA' },
  'CAMPBELLVILLE,ON': { at: { lat: 43.4667, lon: -79.9833 }, country: 'CA' },
  'BRAMPTON,ON': { at: { lat: 43.7315, lon: -79.7624 }, country: 'CA' },
  'TORONTO,ON': { at: { lat: 43.6532, lon: -79.3832 }, country: 'CA' },
  'MISSISSAUGA,ON': { at: { lat: 43.589, lon: -79.6441 }, country: 'CA' },
  'WINDSOR,ON': { at: { lat: 42.3149, lon: -83.0364 }, country: 'CA' },
  'MONTREAL,QC': { at: { lat: 45.5019, lon: -73.5674 }, country: 'CA' },

  // California
  'ONTARIO,CA': { at: { lat: 34.0633, lon: -117.6509 }, country: 'US' },
  'WHITTIER,CA': { at: { lat: 33.9792, lon: -118.0328 }, country: 'US' },
  'SANDIEGO,CA': { at: { lat: 32.7157, lon: -117.1611 }, country: 'US' },
  'KINGCITY,CA': { at: { lat: 36.2127, lon: -121.126 }, country: 'US' },
  'VISTA,CA': { at: { lat: 33.2, lon: -117.2425 }, country: 'US' },
  'CARPINTERIA,CA': { at: { lat: 34.3989, lon: -119.5185 }, country: 'US' },

  // Rest of the US board
  'WALTON,KY': { at: { lat: 38.87, lon: -84.61 }, country: 'US' },
  'MORRIS,IL': { at: { lat: 41.36, lon: -88.42 }, country: 'US' },
  'HIGHLAND,IL': { at: { lat: 38.74, lon: -89.68 }, country: 'US' },
  'NAMPA,ID': { at: { lat: 43.5407, lon: -116.5635 }, country: 'US' },
  'COPPELL,TX': { at: { lat: 32.9546, lon: -96.99 }, country: 'US' },
  'DURANGO,CO': { at: { lat: 37.2753, lon: -107.8801 }, country: 'US' },
  'SAINTPETERSBURG,FL': { at: { lat: 27.7676, lon: -82.6403 }, country: 'US' },
  'KALAMAZOO,MI': { at: { lat: 42.2917, lon: -85.5872 }, country: 'US' },
  'CHEYENNE,WY': { at: { lat: 41.14, lon: -104.8202 }, country: 'US' },
  'CARLISLE,PA': { at: { lat: 40.2015, lon: -77.2003 }, country: 'US' },
  'OMEGA,GA': { at: { lat: 31.34, lon: -83.59 }, country: 'US' },
  'FRANKLIN,IN': { at: { lat: 39.48, lon: -86.05 }, country: 'US' },
};

export const normalisePlace = (s: string): string => s.toUpperCase().replace(/\s+/g, '');

export function lookupPlace(raw: string | null): Place | null {
  if (!raw) return null;
  return PLACES[normalisePlace(raw)] ?? null;
}
