import OpenAI from "openai";
import { normalizeReceiptInput } from "./normalize.js";
import type { ParseMeta, Receipt } from "./types.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const PROMPT = `
You are a receipt parsing assistant.

Output strict JSON with this shape:
{
  "merchant": "string",
  "date": "string",
  "lineItems": [{ "name": "string", "amount": number }],
  "total": number
}

Rules:
1) Include only purchased product/service line items in lineItems.
2) Do NOT include tax, discount, service fee, shipping, tips, or subtotal in lineItems.
3) Put tax/discount/tip ambiguities in merchant/date as empty if unclear.
4) If a field is missing or unreadable, return empty string or 0.
5) Amount values must be numbers, not strings.
6) Respond with JSON only, no markdown.
`;

function parseJsonResponse(raw: string): unknown {
  const candidate = raw.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("No JSON object in model output");
    }
    return JSON.parse(objectMatch[0]);
  }
}

function isQuotaExceededError(error: unknown): boolean {
  const candidate = error as { status?: number; code?: string; message?: string };
  const message = String(candidate?.message ?? "").toLowerCase();
  return (
    candidate?.status === 429 &&
    (candidate?.code === "insufficient_quota" ||
      message.includes("exceeded your current quota") ||
      message.includes("billing"))
  );
}

export function buildConfidenceHints(receipt: Receipt): string[] {
  const hints: string[] = [];
  if (!receipt.merchant) hints.push("merchant");
  if (!receipt.date) hints.push("date");
  if (receipt.lineItems.length === 0) hints.push("lineItems");
  if (!receipt.total || receipt.total <= 0) hints.push("total");
  return hints;
}

export async function parseReceiptWithLlm(imageBytes: Buffer, mimeType: string): Promise<{ receipt: Receipt; meta: ParseMeta }> {
  if (!process.env.OPENAI_API_KEY) {
    const fallback = normalizeReceiptInput({});
    return {
      receipt: fallback,
      meta: {
        warnings: ["OPENAI_API_KEY is missing. Returned blank editable structure."],
        confidenceHints: ["merchant", "date", "lineItems", "total"],
        model: MODEL,
        attempts: 0
      }
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 20_000,
    maxRetries: 0
  });
  const imageBase64 = imageBytes.toString("base64");
  const warnings: string[] = [];
  let rawOutput = "";
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    attemptsMade = attempt;
    try {
      const response = await client.responses.create({
        model: MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}`, detail: "auto" }
            ]
          }
        ]
      });

      rawOutput = response.output_text;
      const normalized = normalizeReceiptInput(parseJsonResponse(rawOutput));

      if (attempt > 1) warnings.push("LLM output required retry due to malformed JSON.");
      return {
        receipt: normalized,
        meta: {
          warnings,
          rawOutput,
          confidenceHints: buildConfidenceHints(normalized),
          model: MODEL,
          attempts: attempt
        }
      };
    } catch (error) {
      warnings.push(`Parse attempt ${attempt} failed: ${(error as Error).message}`);
      if (isQuotaExceededError(error)) {
        warnings.push("OpenAI API quota/billing limit reached. Update billing or use a funded API key.");
        break;
      }
    }
  }

  const fallback = normalizeReceiptInput({});
  return {
    receipt: fallback,
    meta: {
      warnings: [...warnings, "Fell back to blank editable structure after repeated parse failure."],
      rawOutput,
      confidenceHints: ["merchant", "date", "lineItems", "total"],
      model: MODEL,
      attempts: attemptsMade
    }
  };
}

export { MODEL as RECEIPT_MODEL };
