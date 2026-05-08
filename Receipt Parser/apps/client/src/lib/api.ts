import { API_BASE, PARSE_REQUEST_TIMEOUT_MS } from "./constants.js";
import type { ParseMeta, Receipt, StoredReceipt } from "./types.js";

export type ParseResponse =
  | { ok: true; receipt: Receipt; meta: ParseMeta }
  | { ok: false; error: string; details?: string; receipt?: Receipt; meta?: ParseMeta };

export async function fetchParseReceipt(file: File, signal: AbortSignal): Promise<ParseResponse> {
  const form = new FormData();
  form.append("receipt", file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/parse-receipt`, { method: "POST", body: form, signal });
  } catch {
    return { ok: false, error: "network", details: "No response from server" };
  }
  const data = (await response.json()) as {
    receipt?: Receipt;
    meta?: ParseMeta;
    error?: string;
    details?: unknown;
  };
  if (!response.ok) {
    return {
      ok: false,
      error: data.error ?? "Parse failed",
      details: typeof data.details === "string" ? data.details : undefined
    };
  }
  return { ok: true, receipt: data.receipt as Receipt, meta: data.meta as ParseMeta };
}

export type SaveResponse = { ok: true; id: string } | { ok: false; message: string };

export async function fetchSaveReceipt(payload: Record<string, unknown>): Promise<SaveResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/save-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    return { ok: false, message: "Network error" };
  }
  const data = (await response.json()) as { receipt?: { id: string }; error?: string };
  if (!response.ok) {
    return { ok: false, message: data.error ?? "Save failed" };
  }
  return { ok: true, id: data.receipt?.id ?? "" };
}

export type ListReceiptsResult =
  | { ok: true; receipts: StoredReceipt[] }
  | { ok: false; message: string };

export async function fetchListReceipts(): Promise<ListReceiptsResult> {
  try {
    const response = await fetch(`${API_BASE}/receipts`);
    const data = (await response.json()) as { receipts?: StoredReceipt[] };
    if (!response.ok) {
      return { ok: false, message: "Failed to load archive" };
    }
    return { ok: true, receipts: data.receipts ?? [] };
  } catch {
    return { ok: false, message: "Cannot reach server" };
  }
}

export function parseTimeoutMs(): number {
  return PARSE_REQUEST_TIMEOUT_MS;
}
