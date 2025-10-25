import { Coordinates, CurrencyCode } from './delivery.types';

export function computeDistanceKm(
  a?: Coordinates,
  b?: Coordinates
): number | null {
  if (!a || !b) return null;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const c =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return R * d;
}

export function estimateEtaMinutes(
  distanceKm: number,
  avgSpeedKmH: number,
  overheadMin = 10
): number {
  if (distanceKm <= 0 || avgSpeedKmH <= 0) return overheadMin;
  const travelMinutes = (distanceKm / avgSpeedKmH) * 60;
  return Math.round(overheadMin + travelMinutes);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Normalize various currency formats to our CurrencyCode union
export function normalizeCurrencyCode(input?: string): CurrencyCode {
  const code = (input ?? 'EUR').toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'GBP') return code;
  // Some providers return lowercase 'eur' or other variants
  if (code === 'EURO' || code === 'EUR0' || code === 'Eur') return 'EUR';
  return 'EUR';
}

// Attempt to derive ETA minutes from provider raw payload
export function deriveEtaMinutesFromRaw(raw: any): number | undefined {
  try {
    if (!raw) return undefined;
    if (typeof raw.duration === 'number' && raw.duration > 0) {
      return Math.round(raw.duration);
    }
    if (typeof raw.dropoff_eta === 'string') {
      const etaMs = new Date(raw.dropoff_eta).getTime() - Date.now();
      const minutes = Math.ceil(etaMs / 60000);
      if (minutes > 0) return minutes;
    }
  } catch {
    // ignore parse issues
  }
  return undefined;
}
