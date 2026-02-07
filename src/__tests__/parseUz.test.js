import { describe, expect, it } from "vitest";
import { parseInput, parsePaymentInput } from "../lib/parse";

describe("parseInput (uz)", () => {
  it("parses monthly income in uzbek", () => {
    const parsed = parseInput("oylik 4 mln");
    expect(parsed.type).toBe("income");
    expect(parsed.incomePeriod).toBe("monthly");
    expect(parsed.amount).toBe(4000000);
  });

  it("parses expense category and relative date in uzbek", () => {
    const now = new Date("2026-02-07T12:00:00");
    const parsed = parseInput("taksi 18 ming kecha", now);
    expect(parsed.type).toBe("expense");
    expect(parsed.category).toBe("transport");
    expect(parsed.amount).toBe(18000);
    expect(parsed.occurredAtISO.slice(0, 10)).toBe("2026-02-06");
  });

  it("parses debt mode in uzbek", () => {
    const parsed = parseInput("qarz berdim 200 ming");
    expect(parsed.debtMode).toBe("lend");
    expect(parsed.amount).toBe(200000);
  });
});

describe("parsePaymentInput (uz)", () => {
  it("detects monthly recurrence in uzbek", () => {
    const parsed = parsePaymentInput("internet 120 ming 15.02.2026 har oy");
    expect(parsed.amount).toBe(120000);
    expect(parsed.recurrence).toBe("monthly");
    expect(parsed.payDateISO).toBe("2026-02-15");
  });
});
