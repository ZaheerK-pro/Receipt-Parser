# Receipt Parser AI

Upload **JPG/PNG** receipts, get **merchant, date, line items, and total** (via **OpenAI** and/or **local OCR**), edit inline, and **save** to `apps/server/data/receipts.json`. No database.

**Stack:** Vite + TypeScript (client) · Express + TypeScript (server) · optional OpenAI · Tesseract + Sharp for local parsing.

---

## Setup

1. **Node.js** 18+ and **npm** installed.

2. Install dependencies (from this folder):

   ```bash
   npm install
   ```

3. Create `.env` from `.env.example` and adjust:
   - `OPENAI_API_KEY` — optional; without it or on quota errors, **local OCR** is used when possible.
   - `USE_LOCAL_PARSER_ONLY=true` — skip OpenAI entirely.
   - `PORT` — API port (default **8787**).
   - `VITE_API_URL` — only if the API is not at `http://localhost:8787`.

---

## Run

```bash
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)  
- API: `http://localhost:<PORT>` (default **8787**)

**Other:** `npm run build` — compile client + server · `npm run test` — server tests.

---

## Use

1. **Parse** — drop or choose an image → **Parse receipt** → fix fields if needed → **Save receipt**.  
2. **Archive** — search and browse saved receipts.  
3. Only **JPEG** and **PNG** are accepted for parsing.

---

## More detail

**File layout, what each file does, OCR, and step-by-step parsing:** see **[EXPLANATION.md](./EXPLANATION.md)**.

**API:** `POST /parse-receipt` (form field `receipt`), `POST /save-receipt` (JSON body), `GET /receipts`.

License: **ISC** (`package.json`).
