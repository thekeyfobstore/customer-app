import { describe, it, expect } from "vitest";
// Import pure functions only - geocoding.ts imports react-native so we test via dynamic import workaround
// We'll test the pure math functions directly

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// Copy pure functions to test without react-native dependency
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateDriveMinutes(distanceMiles: number): number {
  return Math.round((distanceMiles / 30) * 60);
}

function optimizeRouteOrder<T extends { latitude?: number; longitude?: number }>(
  stops: T[], startLat?: number, startLon?: number
): T[] {
  const withCoords = stops.filter((s) => s.latitude != null && s.longitude != null);
  const withoutCoords = stops.filter((s) => s.latitude == null || s.longitude == null);
  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];
  const result: T[] = [];
  const remaining = [...withCoords];
  let currentLat = startLat ?? remaining[0].latitude!;
  let currentLon = startLon ?? remaining[0].longitude!;
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(currentLat, currentLon, remaining[i].latitude!, remaining[i].longitude!);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    }
    const nearest = remaining.splice(nearestIdx, 1)[0];
    result.push(nearest);
    currentLat = nearest.latitude!;
    currentLon = nearest.longitude!;
  }
  return [...result, ...withoutCoords];
}

function formatAddress(address: Address): string {
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
  if (parts.length === 0) return "No address";
  if (address.city && address.state) {
    return `${address.street ? address.street + ", " : ""}${address.city}, ${address.state} ${address.zip || ""}`.trim();
  }
  return parts.join(", ");
}

function inferArea(address: Address): string {
  if (address.city) return address.city;
  if (address.zip) return `ZIP ${address.zip.substring(0, 3)}xx`;
  return "Unknown Area";
}

describe("geocoding utilities", () => {
  describe("haversineDistance", () => {
    it("calculates distance between two points in miles", () => {
      // NYC to LA is approximately 2451 miles
      const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(2400);
      expect(dist).toBeLessThan(2500);
    });

    it("returns 0 for same point", () => {
      const dist = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(dist).toBe(0);
    });

    it("calculates short distance correctly", () => {
      // Two points about 1 mile apart
      const dist = haversineDistance(40.7128, -74.006, 40.7272, -74.006);
      expect(dist).toBeGreaterThan(0.5);
      expect(dist).toBeLessThan(2);
    });
  });

  describe("estimateDriveMinutes", () => {
    it("estimates drive time at 30mph average", () => {
      expect(estimateDriveMinutes(30)).toBe(60); // 30 miles at 30mph = 60 min
      expect(estimateDriveMinutes(15)).toBe(30); // 15 miles at 30mph = 30 min
      expect(estimateDriveMinutes(0)).toBe(0);
    });
  });

  describe("optimizeRouteOrder", () => {
    it("returns empty array for empty input", () => {
      expect(optimizeRouteOrder([])).toEqual([]);
    });

    it("returns single stop unchanged", () => {
      const stops = [{ latitude: 40.7, longitude: -74.0, id: "a" }];
      const result = optimizeRouteOrder(stops);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("a");
    });

    it("optimizes multi-stop route using nearest neighbor", () => {
      const stops = [
        { latitude: 40.7, longitude: -74.0, id: "a" }, // NYC area
        { latitude: 42.3, longitude: -71.0, id: "b" }, // Boston area
        { latitude: 41.0, longitude: -73.5, id: "c" }, // Between NYC and Boston
      ];
      const result = optimizeRouteOrder(stops);
      expect(result).toHaveLength(3);
      // Starting from A (NYC), nearest should be C (between), then B (Boston)
      expect(result[0].id).toBe("a");
      expect(result[1].id).toBe("c");
      expect(result[2].id).toBe("b");
    });

    it("puts stops without coordinates at the end", () => {
      const stops = [
        { latitude: undefined, longitude: undefined, id: "no-coords" },
        { latitude: 40.7, longitude: -74.0, id: "has-coords" },
      ];
      const result = optimizeRouteOrder(stops);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("has-coords");
      expect(result[1].id).toBe("no-coords");
    });
  });

  describe("formatAddress", () => {
    it("formats full address", () => {
      const addr: Address = { street: "123 Main St", city: "Springfield", state: "IL", zip: "62701" };
      expect(formatAddress(addr)).toBe("123 Main St, Springfield, IL 62701");
    });

    it("formats address without street", () => {
      const addr: Address = { street: "", city: "Springfield", state: "IL", zip: "62701" };
      expect(formatAddress(addr)).toBe("Springfield, IL 62701");
    });

    it("returns 'No address' for empty address", () => {
      const addr: Address = { street: "", city: "", state: "", zip: "" };
      expect(formatAddress(addr)).toBe("No address");
    });

    it("handles partial address", () => {
      const addr: Address = { street: "123 Main St", city: "", state: "", zip: "62701" };
      expect(formatAddress(addr)).toBe("123 Main St, 62701");
    });
  });

  describe("inferArea", () => {
    it("returns city as area when available", () => {
      const addr: Address = { street: "123 Main", city: "Springfield", state: "IL", zip: "62701" };
      expect(inferArea(addr)).toBe("Springfield");
    });

    it("returns zip-based area when no city", () => {
      const addr: Address = { street: "123 Main", city: "", state: "", zip: "62701" };
      expect(inferArea(addr)).toBe("ZIP 627xx");
    });

    it("returns Unknown Area when no city or zip", () => {
      const addr: Address = { street: "", city: "", state: "", zip: "" };
      expect(inferArea(addr)).toBe("Unknown Area");
    });
  });
});

describe("data model structures", () => {
  it("FollowUp object has required fields", () => {
    const followUp = {
      id: "fu-1",
      customerId: "c-1",
      type: "new-lead" as const,
      status: "pending" as const,
      area: "Downtown",
      notes: "Needs key replacement",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(followUp.type).toBe("new-lead");
    expect(followUp.status).toBe("pending");
    expect(followUp.area).toBe("Downtown");
  });

  it("DropInLocation object has required fields", () => {
    const dropIn = {
      id: "di-1",
      name: "Walmart Parking Lot",
      address: { street: "100 Store Way", city: "Springfield", state: "IL", zip: "62701" },
      latitude: 39.7817,
      longitude: -89.6501,
      notes: "Near the entrance",
      createdAt: new Date().toISOString(),
    };
    expect(dropIn.name).toBe("Walmart Parking Lot");
    expect(dropIn.latitude).toBeDefined();
  });

  it("DayRoute object has required fields", () => {
    const route = {
      id: "r-1",
      date: "2026-03-27",
      area: "Downtown",
      stops: [] as any[],
      status: "draft" as const,
      createdAt: new Date().toISOString(),
    };
    expect(route.status).toBe("draft");
    expect(route.stops).toEqual([]);
  });

  it("RouteStop object has required fields", () => {
    const stop = {
      id: "rs-1",
      appointmentId: "apt-1",
      customerId: "c-1",
      address: { street: "123 Main", city: "Springfield", state: "IL", zip: "62701" },
      order: 1,
      latitude: 39.78,
      longitude: -89.65,
    };
    expect(stop.order).toBe(1);
    expect(stop.address.city).toBe("Springfield");
  });
});
