import { describe, it, expect } from "vitest";
import {
  generateId,
  formatPhone,
  getInitials,
  formatDate,
  formatTime,
  formatDuration,
  getRelativeDate,
  getStatusColor,
} from "../lib/helpers";
import type {
  Customer,
  Vehicle,
  Address,
  ExtractedInfo,
  Appointment,
  Message,
} from "../lib/types";

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(5);
  });

  it("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("formatPhone", () => {
  it("formats 10-digit phone", () => {
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
  });

  it("formats 11-digit phone with country code", () => {
    expect(formatPhone("15551234567")).toBe("+1 (555) 123-4567");
  });

  it("returns original for non-standard format", () => {
    expect(formatPhone("123")).toBe("123");
  });
});

describe("getInitials", () => {
  it("returns initials from names", () => {
    expect(getInitials("John", "Doe")).toBe("JD");
  });

  it("handles empty names", () => {
    expect(getInitials("", "")).toBe("?");
  });

  it("handles single name", () => {
    expect(getInitials("Alice", "")).toBe("A");
  });
});

describe("formatDuration", () => {
  it("formats minutes only", () => {
    expect(formatDuration(30)).toBe("30 min");
  });

  it("formats hours only", () => {
    expect(formatDuration(60)).toBe("1 hr");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });
});

describe("getStatusColor", () => {
  it("returns correct colors", () => {
    expect(getStatusColor("scheduled")).toBe("primary");
    expect(getStatusColor("completed")).toBe("success");
    expect(getStatusColor("cancelled")).toBe("error");
    expect(getStatusColor("no-show")).toBe("warning");
    expect(getStatusColor("unknown")).toBe("muted");
  });
});

describe("Type definitions", () => {
  it("Vehicle type has correct shape", () => {
    const vehicle: Vehicle = {
      id: "v1",
      year: "2023",
      make: "Toyota",
      model: "Camry",
      vin: "1HGCM82633A123456",
    };
    expect(vehicle.make).toBe("Toyota");
    expect(vehicle.vin).toBe("1HGCM82633A123456");
  });

  it("Address type has correct shape", () => {
    const address: Address = {
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    };
    expect(address.city).toBe("Springfield");
  });

  it("Customer type supports vehicles and address", () => {
    const customer: Customer = {
      id: "c1",
      firstName: "John",
      lastName: "Doe",
      phone: "5551234567",
      email: "john@example.com",
      company: "Acme",
      notes: "",
      tags: ["vip"],
      vehicles: [
        {
          id: "v1",
          year: "2023",
          make: "Honda",
          model: "Civic",
          vin: "",
        },
      ],
      address: {
        street: "456 Oak Ave",
        city: "Anytown",
        state: "CA",
        zip: "90210",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      openPhoneContactId: "op_123",
    };
    expect(customer.vehicles).toHaveLength(1);
    expect(customer.vehicles![0].make).toBe("Honda");
    expect(customer.address!.city).toBe("Anytown");
    expect(customer.openPhoneContactId).toBe("op_123");
  });

  it("ExtractedInfo type has correct shape", () => {
    const extracted: ExtractedInfo = {
      firstName: "Jane",
      lastName: "Smith",
      phone: "5559876543",
      email: "jane@test.com",
      company: "Smith Auto",
      address: {
        street: "789 Elm St",
        city: "Metropolis",
        state: "NY",
        zip: "10001",
      },
      vehicles: [
        {
          id: "ev1",
          year: "2022",
          make: "Ford",
          model: "F-150",
          vin: "",
        },
      ],
    };
    expect(extracted.vehicles).toHaveLength(1);
    expect(extracted.address!.state).toBe("NY");
  });
});
