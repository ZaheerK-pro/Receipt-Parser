import type { ParseMeta, Receipt, StoredReceipt } from "./types.js";

export function emptyReceipt(): Receipt {
  return { merchant: "", date: "", lineItems: [], total: 0 };
}

export type ReceiptStats = {
  totalReceipts: number;
  totalAmount: number;
  thisMonth: number;
  parsedSuccessfully: number;
};

export function computeReceiptStats(receipts: StoredReceipt[]): ReceiptStats {
  const totalReceipts = receipts.length;
  const totalAmount = receipts.reduce((sum, r) => sum + (Number.isFinite(r.data.total) ? r.data.total : 0), 0);
  const now = new Date();
  const thisMonth = receipts
    .filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + (Number.isFinite(r.data.total) ? r.data.total : 0), 0);
  const parsedSuccessfully = receipts.filter(
    (r) => (r.data.lineItems?.length ?? 0) > 0 || (r.data.total ?? 0) > 0
  ).length;
  return { totalReceipts, totalAmount, thisMonth, parsedSuccessfully };
}

export function filterReceiptsBySearch(list: StoredReceipt[], query: string): StoredReceipt[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((r) => {
    const blob = [r.id, r.sourceFileName ?? "", r.data.merchant, r.data.date, String(r.data.total)].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

export function statusAfterSuccessfulParse(meta: ParseMeta): string {
  return meta.model.includes("tesseract")
    ? "Parsed via local OCR. Review highlighted fields."
    : "Parsed. Review highlighted fields.";
}
