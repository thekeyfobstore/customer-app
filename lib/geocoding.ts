import { Address } from "./types";
import { Platform, Linking } from "react-native";

/**
 * Geocode an address to coordinates using the free Nominatim (OpenStreetMap) API.
 * Rate limit: 1 request per second. No API key required.
 */
export async function geocodeAddress(address: Address): Promise<{ latitude: number; longitude: number } | null> {
  const query = [address.street, address.city, address.state, address.zip].filter(Boolean).join(", ");
  if (!query.trim()) return null;

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
      {
        headers: {
          "User-Agent": "ClientBook-App/1.0",
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in miles.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate drive time in minutes based on distance (assumes average 30 mph for local driving).
 */
export function estimateDriveMinutes(distanceMiles: number): number {
  return Math.round((distanceMiles / 30) * 60);
}

/**
 * Optimize route order using nearest-neighbor heuristic.
 * Takes an array of stops with coordinates and returns them in optimized order.
 */
export function optimizeRouteOrder<T extends { latitude?: number; longitude?: number }>(
  stops: T[],
  startLat?: number,
  startLon?: number
): T[] {
  const withCoords = stops.filter((s) => s.latitude != null && s.longitude != null);
  const withoutCoords = stops.filter((s) => s.latitude == null || s.longitude == null);

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  const result: T[] = [];
  const remaining = [...withCoords];

  // Start from the provided start position or the first stop
  let currentLat = startLat ?? remaining[0].latitude!;
  let currentLon = startLon ?? remaining[0].longitude!;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        currentLat, currentLon,
        remaining[i].latitude!, remaining[i].longitude!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0];
    result.push(nearest);
    currentLat = nearest.latitude!;
    currentLon = nearest.longitude!;
  }

  return [...result, ...withoutCoords];
}

/**
 * Format an address for display.
 */
export function formatAddress(address: Address): string {
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
  if (parts.length === 0) return "No address";
  if (address.city && address.state) {
    return `${address.street ? address.street + ", " : ""}${address.city}, ${address.state} ${address.zip || ""}`.trim();
  }
  return parts.join(", ");
}

/**
 * Open directions in the device's native maps app.
 * Supports multi-stop routes.
 */
export function openInMaps(stops: Array<{ latitude: number; longitude: number; label?: string }>) {
  if (stops.length === 0) return;

  if (Platform.OS === "ios") {
    // Apple Maps with waypoints
    if (stops.length === 1) {
      const { latitude, longitude } = stops[0];
      Linking.openURL(`maps://app?daddr=${latitude},${longitude}`);
    } else {
      // Apple Maps supports saddr and daddr, use Google Maps for multi-stop
      const waypoints = stops.map((s) => `${s.latitude},${s.longitude}`).join("/");
      Linking.openURL(`https://www.google.com/maps/dir/${waypoints}`);
    }
  } else if (Platform.OS === "android") {
    // Google Maps with waypoints
    const origin = stops[0];
    const dest = stops[stops.length - 1];
    const waypointStr = stops.length > 2
      ? stops.slice(1, -1).map((s) => `${s.latitude},${s.longitude}`).join("|")
      : "";
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}`;
    if (waypointStr) url += `&waypoints=${waypointStr}`;
    Linking.openURL(url);
  } else {
    // Web fallback
    const waypoints = stops.map((s) => `${s.latitude},${s.longitude}`).join("/");
    Linking.openURL(`https://www.google.com/maps/dir/${waypoints}`);
  }
}

/**
 * Infer area/zone from an address (uses city + first part of zip).
 */
export function inferArea(address: Address): string {
  if (address.city) {
    return address.city;
  }
  if (address.zip) {
    return `ZIP ${address.zip.substring(0, 3)}xx`;
  }
  return "Unknown Area";
}
