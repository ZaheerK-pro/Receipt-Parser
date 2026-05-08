import { parseReceiptWithLlm, RECEIPT_MODEL } from "./llm.js";
import { parseReceiptLocally } from "./localParser.js";
import { normalizeReceiptInput } from "./normalize.js";
import type { ParseMeta, Receipt } from "./types.js";

const PARSE_TIMEOUT_MS = Number(process.env.PARSE_TIMEOUT_MS ?? 70_000);
const USE_LOCAL_PARSER_ONLY = process.env.USE_LOCAL_PARSER_ONLY === "true";

function shouldFallbackToLocalParser(warnings: string[] | undefined): boolean {
  if (!warnings?.length) return false;
  return warnings.some((warning) =>
    /(openai_api_key is missing|parse attempt .* failed|fell back to blank editable structure|parse timed out)/i.test(warning)
  );
}

function sanitizeWarningsForLocalFallback(warnings: string[] | undefined): string[] {
  if (!warnings?.length) return [];
  return warnings.filter((warning) => !/blank editable structure/i.test(warning));
}

export type ParseResult = { receipt: Receipt; meta: ParseMeta };

export async function parseReceiptBuffer(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  const primary = USE_LOCAL_PARSER_ONLY
    ? await parseReceiptLocally(buffer)
    : await Promise.race([
        parseReceiptWithLlm(buffer, mimeType),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Parse timed out after ${Math.round(PARSE_TIMEOUT_MS / 1000)} seconds`)), PARSE_TIMEOUT_MS)
        )
      ]);

  if (USE_LOCAL_PARSER_ONLY || !shouldFallbackToLocalParser(primary.meta.warnings)) {
    return primary;
  }

  const local = await parseReceiptLocally(buffer);
  return {
    receipt: local.receipt,
    meta: {
      ...local.meta,
      warnings: [...sanitizeWarningsForLocalFallback(primary.meta.warnings), ...local.meta.warnings]
    }
  };
}

export async function parseReceiptWithCatchFallback(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult & { sourceFileName?: string }> {
  try {
    return await parseReceiptBuffer(buffer, mimeType);
  } catch (error) {
    try {
      const local = await parseReceiptLocally(buffer);
      return {
        ...local,
        meta: {
          ...local.meta,
          warnings: [(error as Error).message, ...local.meta.warnings]
        }
      };
    } catch (localError) {
      return {
        receipt: normalizeReceiptInput({}),
        meta: {
          warnings: [
            (error as Error).message,
            `Local OCR failed: ${(localError as Error).message}`,
            "Parser unavailable. Please edit fields manually and save."
          ],
          rawOutput: "",
          confidenceHints: ["merchant", "date", "lineItems", "total"],
          model: RECEIPT_MODEL,
          attempts: 0
        }
      };
    }
  }
}
