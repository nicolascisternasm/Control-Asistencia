// Utilidades de geolocalización
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const PRECISION_MINIMA_METROS = 80;

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'es' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string };
      return data.display_name ?? null;
    }
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lon,
    });
    if (!results.length) return null;
    const r = results[0];
    const parts = [
      r.street,
      r.streetNumber,
      r.city ?? r.subregion ?? r.district,
      r.region,
    ].filter(Boolean);
    return parts.join(', ') || null;
  } catch (e) {
    console.log('[geo] reverseGeocode error', e);
    return null;
  }
}

export function buildMapsUrl(lat: number, lon: number): string {
  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?ll=${lat},${lon}&q=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function buildStaticMapUrl(
  lat: number,
  lon: number,
  opts?: {
    lat2?: number;
    lon2?: number;
    width?: number;
    height?: number;
    zoom?: number;
  },
): string {
  const w = opts?.width ?? 640;
  const h = opts?.height ?? 320;
  const zoom = opts?.zoom ?? 16;
  let markers = `&markers=${lat},${lon},red1`;
  if (opts?.lat2 !== undefined && opts?.lon2 !== undefined) {
    markers += `&markers=${opts.lat2},${opts.lon2},lightblue2`;
  }
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${w}x${h}&maptype=mapnik${markers}`;
}

export function formatDistancia(metros: number | null | undefined): string {
  if (metros == null) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(2)} km`;
}
