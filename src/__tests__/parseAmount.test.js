import { describe, expect, it } from "vitest";
import { parseAmount } from "../lib/parseAmount";

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("14600000")).toBe(14600000);
    expect(parseAmount("14 600 000")).toBe(14600000);
  });

  it("parses millions", () => {
    expect(parseAmount("14.6 млн")).toBe(14600000);
    expect(parseAmount("14,6 млн")).toBe(14600000);
    expect(parseAmount("2.5 млн")).toBe(2500000);
    expect(parseAmount("4 mln")).toBe(4000000);
    expect(parseAmount("1.2 million")).toBe(1200000);
  });

  it("parses thousands", () => {
    expect(parseAmount("25 тыс")).toBe(25000);
    expect(parseAmount("25 тысяч")).toBe(25000);
    expect(parseAmount("18 ming")).toBe(18000);
    expect(parseAmount("12.5 ming")).toBe(12500);
  });
});
