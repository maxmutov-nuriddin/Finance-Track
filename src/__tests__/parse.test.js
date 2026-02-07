import { describe, expect, it } from "vitest";
import { parseInput } from "../lib/parse";

describe("parseInput debt mode detection", () => {
  it("detects borrow mode", () => {
    const parsed = parseInput("взял долг 100000");
    expect(parsed.debtMode).toBe("borrow");
  });

  it("detects repay mode", () => {
    const parsed = parseInput("отдал долг 50000");
    expect(parsed.debtMode).toBe("repay");
  });

  it("detects lend mode", () => {
    const parsed = parseInput("дал долг 75000");
    expect(parsed.debtMode).toBe("lend");
  });

  it("detects collect mode", () => {
    const parsed = parseInput("забрал долг 60000");
    expect(parsed.debtMode).toBe("collect");
  });
});
