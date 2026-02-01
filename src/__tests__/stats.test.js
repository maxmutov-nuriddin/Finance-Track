import { describe, expect, it } from "vitest";
import { computeStats } from "../lib/calcs";

it("computeStats counts income and expense", () => {
  const stats = computeStats([
    { type: "income", amount: 14600000 },
    { type: "expense", amount: 500000 }
  ]);
  expect(stats.income).toBe(14600000);
  expect(stats.expense).toBe(500000);
  expect(stats.net).toBe(14100000);
});
