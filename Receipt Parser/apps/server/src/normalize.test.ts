import { describe, expect, it } from "vitest";
import { normalizeReceiptInput } from "./normalize.js";

describe("normalizeReceiptInput", () => {
  it("returns safe defaults for malformed data", () => {
    const result = normalizeReceiptInput({ merchant: 123, total: "nan" });
    expect(result).toEqual({
      merchant: "",
      date: "",
      lineItems: [],
      total: 0
    });
  });

  it("trims strings and keeps finite numbers", () => {
    const result = normalizeReceiptInput({
      merchant: "  Corner Store ",
      date: " 2026-05-06 ",
      total: 14.5,
      lineItems: [{ name: " Bread ", amount: 3.5 }]
    });
    expect(result).toEqual({
      merchant: "Corner Store",
      date: "2026-05-06",
      lineItems: [{ name: "Bread", amount: 3.5 }],
      total: 14.5
    });
  });
});
