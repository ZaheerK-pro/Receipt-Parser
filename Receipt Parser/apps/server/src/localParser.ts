import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { normalizeReceiptInput } from "./normalize.js";
import type { ParseMeta, Receipt } from "./types.js";

const LOCAL_MODEL = "tesseract.js-local";

function pickMerchant(lines: string[]): string {
  const candidates = lines
    .slice(0, 6)
    .map((line) => line.replace(/[^a-zA-Z0-9&' .-]/g, "").trim())
    .filter((line) => line.length >= 3);
  return candidates[0] ?? "";
}

function pickDate(text: string): string {
  const dateMatch =
    text.match(/\b\d{4}-\d{2}-\d{2}\b/) ??
    text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
  return dateMatch?.[0] ?? "";
}

function parseAmount(raw: string): number {
  const normalized = raw.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function normalizeLine(line: string): string {
  return line.replace(/\s{2,}/g, " ").replace(/[|]/g, "I").trim();
}

function extractAmount(raw: string): number | null {
  const amountMatch = raw.match(/([0-9]{1,6}(?:\.[0-9]{1,2})?)\s*(?:rs|inr)?\.?\s*$/i);
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[1]);
  return amount > 0 ? amount : null;
}

async function buildPreprocessedImage(imageBytes: Buffer): Promise<Buffer> {
  return sharp(imageBytes)
    .greyscale()
    .normalize()
    .median(1)
    .resize({ width: 1800, withoutEnlargement: false, fit: "inside" })
    .png()
    .toBuffer();
}

function pickTotal(lines: string[]): number {
  const totalLine = [...lines].reverse().find((line) => /(^|\s)total(\s|:|$)/i.test(line) && !/subtotal/i.test(line));
  if (!totalLine) return 0;
  const amountMatch = totalLine.match(/([0-9]{1,6}(?:\.[0-9]{1,2})?)\s*(?:rs|inr)?/gi);
  if (!amountMatch?.length) return 0;
  return parseAmount(amountMatch[amountMatch.length - 1]);
}

function pickLineItems(lines: string[]): Receipt["lineItems"] {
  const ignored = /(subtotal|total|tax|discount|service|shipping|tip|paid|visa|mastercard|approval|cashier|receipt#|receipt no|date|time|phone|street|ave|road|blvd)/i;
  const stopKeywords = /(subtotal|total|tax|paid with|approval)/i;
  const startHints = /(item|description|qty|quantity|price|receipt#|cashier)/i;

  const normalizedLines = lines.map(normalizeLine).filter(Boolean);
  const startIndex = normalizedLines.findIndex((line) => startHints.test(line));
  const endIndex = normalizedLines.findIndex((line, idx) => idx > (startIndex >= 0 ? startIndex : 0) && stopKeywords.test(line));
  const candidateLines =
    startIndex >= 0
      ? normalizedLines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined)
      : normalizedLines;

  const result: Receipt["lineItems"] = [];
  const seen = new Set<string>();

  for (let i = 0; i < candidateLines.length; i++) {
    const line = candidateLines[i];
    if (ignored.test(line)) continue;

    // Common OCR shapes:
    // 1) "1 Bread Whole Wheat 2.99"
    // 2) "Bread Whole Wheat $2.99"
    // 3) name and amount split into adjacent lines.
    let working = line;
    const nextLine = candidateLines[i + 1] ?? "";
    if (!/[0-9]+(?:\.[0-9]{1,2})?\s*(?:rs|inr)?\s*$/i.test(working) && /^[0-9]+(?:\.[0-9]{1,2})?\s*(?:rs|inr)?\s*$/i.test(nextLine)) {
      working = `${working} ${nextLine}`;
      i += 1;
    }

    const amount = extractAmount(working);
    if (amount === null) continue;

    const stripped = working
      .replace(/([0-9]{1,6}(?:\.[0-9]{1,2})?)\s*(?:rs|inr)?\.?\s*$/i, "")
      .replace(/[-:]+$/g, "")
      .replace(/^\d+\s+/, "")
      .replace(/^[xX]\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const name = stripped;
    if (!/[a-zA-Z]/.test(name) || amount <= 0) continue;

    const key = `${name.toLowerCase()}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, amount });
  }

  return result.slice(0, 30);
}

function confidenceHints(receipt: Receipt): string[] {
  const hints: string[] = [];
  if (!receipt.merchant) hints.push("merchant");
  if (!receipt.date) hints.push("date");
  if (!receipt.lineItems.length) hints.push("lineItems");
  if (!receipt.total || receipt.total <= 0) hints.push("total");
  return hints;
}

function scoreParsedReceipt(receipt: Receipt): number {
  const itemsScore = Math.min(receipt.lineItems.length * 3, 21);
  const totalScore = receipt.total > 0 ? 6 : 0;
  const merchantScore = receipt.merchant ? 3 : 0;
  const dateScore = receipt.date ? 2 : 0;
  return itemsScore + totalScore + merchantScore + dateScore;
}

function parseFromText(text: string): Receipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return normalizeReceiptInput({
    merchant: pickMerchant(lines),
    date: pickDate(text),
    lineItems: pickLineItems(lines),
    total: pickTotal(lines)
  });
}

export async function parseReceiptLocally(imageBytes: Buffer): Promise<{ receipt: Receipt; meta: ParseMeta }> {
  const worker = await createWorker("eng");
  try {
    const preprocessed = await buildPreprocessedImage(imageBytes);
    const [baseRun, preprocessedRun] = await Promise.all([
      worker.recognize(imageBytes),
      worker.recognize(preprocessed)
    ]);

    const baseText = baseRun.data.text;
    const preprocessedText = preprocessedRun.data.text;
    const baseParsed = parseFromText(baseText);
    const preprocessedParsed = parseFromText(preprocessedText);
    const bestParsed = scoreParsedReceipt(preprocessedParsed) >= scoreParsedReceipt(baseParsed) ? preprocessedParsed : baseParsed;
    const usedPreprocessed = bestParsed === preprocessedParsed;

    return {
      receipt: bestParsed,
      meta: {
        warnings: [
          `Parsed with local OCR fallback (no paid API required${usedPreprocessed ? ", image-enhanced mode" : ""}). Please verify highlighted fields.`
        ],
        rawOutput: usedPreprocessed ? preprocessedText : baseText,
        confidenceHints: confidenceHints(bestParsed),
        model: LOCAL_MODEL,
        attempts: 1
      }
    };
  } finally {
    await worker.terminate();
  }
}

export { LOCAL_MODEL };
