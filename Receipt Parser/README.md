# Receipt Parser

This is a local full-stack app that parses receipt images (`.jpg`/`.png`), extracts structured fields (OpenAI and/or local OCR), and saves corrected receipts to local JSON storage.

## Stack

- Frontend: Vite + TypeScript (vanilla DOM UI)
- Backend: Node.js + Express + TypeScript
- LLM: OpenAI Responses API (optional; local OCR fallback available)
- Persistence: local JSON file at `apps/server/data/receipts.json`

## Project layout

- `apps/client/src/main.ts` — app state and DOM event wiring
- `apps/client/src/lib/` — API client, domain helpers, types, formatting
- `apps/client/src/ui/` — view templates (HTML strings) and small UI helpers
- `apps/server/src/index.ts` — HTTP routes only
- `apps/server/src/receiptParseService.ts` — parse orchestration (LLM + local OCR)
- `apps/server/src/llm.ts`, `localParser.ts`, `normalize.ts`, `storage.ts` — parsing and persistence

## Run locally

1. Install deps:
   - `npm install`
2. Copy envs:
   - `cp .env.example .env` (or copy manually on Windows)
3. Add `OPENAI_API_KEY` in `.env`
4. Start both frontend and backend:
   - `npm run dev`
5. Open frontend:
   - [http://localhost:5173](http://localhost:5173)

## API

### `POST /parse-receipt`
- form-data: `receipt` (JPG/PNG)
- Response:
```json
{
  "receipt": {
    "merchant": "Fresh Mart",
    "date": "2026-05-06",
    "lineItems": [
      { "name": "Milk", "amount": 3.25 },
      { "name": "Bread", "amount": 2.1 }
    ],
    "total": 5.35
  },
  "meta": {
    "warnings": [],
    "confidenceHints": [],
    "sourceFileName": "receipt.png",
    "model": "gpt-4.1-mini",
    "attempts": 1
  }
}
```

### `POST /save-receipt`
- JSON body:
```json
{
  "merchant": "Fresh Mart",
  "date": "2026-05-06",
  "lineItems": [{ "name": "Milk", "amount": 3.25 }],
  "total": 5.35,
  "sourceFileName": "receipt.png"
}
```

## LLM prompt used

The server prompt is defined in `apps/server/src/llm.ts`:

```text
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
```

## Product decisions implemented

### 1) Definition of line item
- Implemented: only purchased goods/services belong in `lineItems`.
- Excluded from `lineItems`: tax, discounts, tips, shipping, service fees, subtotal.
- Reason: keeps downstream item analytics clean and avoids double counting against `total`.

### 2) LLM failure handling
- Implemented: two parse attempts.
- If model returns malformed/non-JSON output, retry once.
- If still invalid, backend returns blank editable structure (`merchant/date=""`, `lineItems=[]`, `total=0`) and warning metadata.
- Why: user can always continue without being blocked.

### 3) Low confidence handling
- Implemented: backend emits `confidenceHints` for likely weak fields (empty merchant/date, no line items, non-positive total).
- Frontend highlights hinted fields with orange styles and warning text.
- Why: users focus edits where confidence is low instead of rescanning everything.

### 4) Correction UX (highest priority)
- Inline-edit everything on one screen.
- Add/remove line items without modal/page switch.
- Save directly from same view.
- Why: minimizes clicks and cognitive load for “fix and save” workflow.

### 5) Model choice
- Default: `gpt-4.1-mini`.
- Tradeoff: chosen for lower cost + latency while maintaining adequate OCR+structuring quality for MVP.
- Can be changed with `OPENAI_MODEL`.

## Error handling and edge cases

- Malformed LLM output: retry + graceful fallback payload.
- Low-quality images: still returns editable structure and warnings.
- Missing fields: normalized to empty strings/zero and fully editable.
- Missing API key: parse endpoint returns blank editable structure with explicit warning.

## Meaningful tests included

- `apps/server/src/normalize.test.ts`
  - verifies malformed input fallback
  - verifies trimming/sanitization behavior

Run with:
- `npm run test`

## Biggest tradeoffs (PR-style)

1. **Vanilla TypeScript frontend vs React**
   - Chosen for speed and lower setup overhead in a 3–4 hour MVP.
   - Tradeoff is less component structure and harder future scaling of UI complexity.

2. **JSON-file persistence vs SQLite**
   - Chosen for minimal complexity and easy local inspectability.
   - Tradeoff is no concurrency guarantees and limited query ergonomics as data grows.

3. **Heuristic confidence hints vs model-calibrated confidence scores**
   - Chosen because confidence calibration is usually noisy and model-specific.
   - Tradeoff is simpler but less nuanced uncertainty signals.

## Where LLMs were used

- Runtime extraction: receipt image -> structured JSON through prompt + vision model call.
- Output shaping: strict JSON instructions with post-parse normalization.
- Failure handling: retries and fallback user correction flow when output is malformed.
- Development scaffolding: generated initial boilerplate layout and endpoint structure quickly, then manually refined for behavior and tradeoffs.

## With 1 more week

1. Add receipt image preview with per-field click-to-region assist.
2. Add stronger validation (date normalization, currency locale, line-item sum checks).
3. Move persistence to SQLite with searchable history and export.
4. Add background job queue + idempotent parse sessions for larger images and spikes.
5. Add e2e tests for upload/parse/edit/save flow.

## One pushback on this spec

I would push back on requiring confidence behavior without allowing a confidence source in the API contract; for production, confidence should be tied to explicit model/tooling evidence (token logprobs, OCR box quality, or cross-check rules), not only UI heuristics. For this MVP I implemented heuristic hints to preserve speed and avoid false precision.

