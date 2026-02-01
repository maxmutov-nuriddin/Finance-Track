import { describe, expect, it, vi } from "vitest";
import { filterByOccurredAtISO, getPeriodRange } from "../lib/utils";

describe("period filter", () => {
  it("filters by occurredAtISO within range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T12:00:00+05:00"));
    const range = getPeriodRange(2);
    const items = [
      { id: "1", occurredAtISO: "2026-01-31T10:00:00+05:00" },
      { id: "2", occurredAtISO: "2026-02-01T11:00:00+05:00" },
      { id: "3", occurredAtISO: "2026-01-29T10:00:00+05:00" }
    ];
    const filtered = filterByOccurredAtISO(items, range.start, range.end);
    expect(filtered.map((i) => i.id)).toEqual(["1", "2"]);
    vi.useRealTimers();
  });
});
