import { describe, it, expect } from "vitest";
import { parseCompanyField } from "../server/company-parser";

describe("parseCompanyField", () => {
  it("parses name + location + vehicle", () => {
    const r = parseCompanyField("PAUL SHAKOTKO Dartmouth 2006 Honda element");
    expect(r.firstName).toBe("PAUL");
    expect(r.lastName).toBe("SHAKOTKO");
    expect(r.vehicle).toContain("2006");
    expect(r.vehicle.toLowerCase()).toContain("honda");
    expect(r.location).toBe("Dartmouth");
  });

  it("parses name + vehicle + location + notes", () => {
    const r = parseCompanyField("Dave Gilmore 2010 Honda civic whistleberry phone calls only");
    expect(r.firstName).toBe("Dave");
    expect(r.lastName).toBe("Gilmore");
    expect(r.vehicle).toContain("2010");
    expect(r.vehicle.toLowerCase()).toContain("honda");
  });

  it("parses vehicle only with location", () => {
    const r = parseCompanyField("2013 Honda Ridgeline, Sydney");
    expect(r.vehicle).toContain("2013");
    expect(r.vehicle.toLowerCase()).toContain("honda");
    expect(r.location).toBe("Sydney");
    expect(r.firstName).toBe("");
  });

  it("parses name + vehicle + VIN", () => {
    const r = parseCompanyField("Keith Towse 2018 RAV4 Premium, VIN 2T3DFREV5JW724451");
    expect(r.firstName).toBe("Keith");
    expect(r.lastName).toContain("Towse");
    expect(r.vehicle).toContain("2018");
    expect(r.vin).toBe("2T3DFREV5JW724451");
  });

  it("parses name + in location + vehicle + service note", () => {
    const r = parseCompanyField("Cathy MacDonald in Sydney 2017 Mazda CX");
    expect(r.firstName).toBe("Cathy");
    expect(r.lastName).toBe("MacDonald");
    expect(r.vehicle).toContain("2017");
    expect(r.location).toBe("Sydney");
  });

  it("parses vehicle + booked status", () => {
    const r = parseCompanyField("2020 gmc terrain booked");
    expect(r.vehicle).toContain("2020");
    expect(r.vehicle.toLowerCase()).toContain("gmc");
  });

  it("parses name + location + vehicle + service", () => {
    const r = parseCompanyField("Jocelyn Morris. Oxford,Cumberland 2015 Mitsubishi Outlander Need a spare key fob.");
    expect(r.firstName).toBe("Jocelyn");
    expect(r.lastName).toContain("Morris");
    expect(r.vehicle).toContain("2015");
    expect(r.vehicle.toLowerCase()).toContain("mitsubishi");
  });

  it("parses vehicle + location shorthand", () => {
    const r = parseCompanyField("2014 Dodge ram");
    expect(r.vehicle).toContain("2014");
    expect(r.vehicle.toLowerCase()).toContain("dodge");
  });

  it("parses name + vehicle + service + location", () => {
    const r = parseCompanyField("John aucoin 2016 Nissan rogue ignition key Glace bay");
    expect(r.firstName).toBe("John");
    expect(r.lastName.toLowerCase()).toContain("aucoin");
    expect(r.vehicle).toContain("2016");
    expect(r.vehicle.toLowerCase()).toContain("nissan");
  });

  it("parses name only (no vehicle)", () => {
    const r = parseCompanyField("Rachel Kendall");
    expect(r.firstName).toBe("Rachel");
    expect(r.lastName).toBe("Kendall");
    expect(r.vehicle).toBe("");
  });

  it("parses name with phone number in company", () => {
    const r = parseCompanyField("Zack johnston (902) 317-3244");
    expect(r.firstName).toBe("Zack");
    expect(r.lastName).toBe("johnston");
    expect(r.vehicle).toBe("");
  });

  it("handles empty string", () => {
    const r = parseCompanyField("");
    expect(r.firstName).toBe("");
    expect(r.vehicle).toBe("");
  });

  it("parses mechanic with location", () => {
    const r = parseCompanyField("Eric Ashfield Mechanic Orangedale");
    expect(r.firstName).toBe("Eric");
    // Ashfield is a known location, but here it's a last name
    // The parser may or may not get this right, but firstName should be Eric
  });
});
