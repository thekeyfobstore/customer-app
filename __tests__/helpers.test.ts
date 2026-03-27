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

describe("generateId", () => {
  it("should return a non-empty string", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("should return unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("formatPhone", () => {
  it("should format 10-digit US phone numbers", () => {
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
  });

  it("should format 11-digit US phone numbers with country code", () => {
    expect(formatPhone("15551234567")).toBe("+1 (555) 123-4567");
  });

  it("should return original string for other formats", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
});

describe("getInitials", () => {
  it("should return first letters of first and last name", () => {
    expect(getInitials("John", "Doe")).toBe("JD");
  });

  it("should handle single name", () => {
    expect(getInitials("John", "")).toBe("J");
  });

  it("should return ? for empty names", () => {
    expect(getInitials("", "")).toBe("?");
  });
});

describe("formatTime", () => {
  it("should format 24hr time to 12hr", () => {
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});

describe("formatDuration", () => {
  it("should format minutes only", () => {
    expect(formatDuration(30)).toBe("30 min");
  });

  it("should format hours only", () => {
    expect(formatDuration(60)).toBe("1 hr");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });
});

describe("getStatusColor", () => {
  it("should return correct color tokens", () => {
    expect(getStatusColor("scheduled")).toBe("primary");
    expect(getStatusColor("completed")).toBe("success");
    expect(getStatusColor("cancelled")).toBe("error");
    expect(getStatusColor("no-show")).toBe("warning");
    expect(getStatusColor("unknown")).toBe("muted");
  });
});
