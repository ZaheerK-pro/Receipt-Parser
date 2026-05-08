import { receiptSchema, type Receipt } from "./types.js";

export function normalizeReceiptInput(input: unknown): Receipt {
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      merchant: "",
      date: "",
      lineItems: [],
      total: 0
    };
  }

  const sanitized = parsed.data;
  return {
    merchant: sanitized.merchant.trim(),
    date: sanitized.date.trim(),
    lineItems: sanitized.lineItems.map((item) => ({
      name: item.name.trim(),
      amount: Number.isFinite(item.amount) ? item.amount : 0
    })),
    total: Number.isFinite(sanitized.total) ? sanitized.total : 0
  };
}
