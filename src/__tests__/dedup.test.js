import { describe, expect, it } from "vitest";
import { dedupById } from "../lib/utils";

it("dedupById keeps unique ids", () => {
  const rows = [
    { id: "a", amount: 1 },
    { id: "a", amount: 2 },
    { id: "b", amount: 3 }
  ];
  const deduped = dedupById(rows);
  expect(deduped.length).toBe(2);
  expect(deduped.find((r) => r.id === "a")?.amount).toBe(2);
});
