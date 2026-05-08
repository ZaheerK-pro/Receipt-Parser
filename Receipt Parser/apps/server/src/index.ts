import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import express from "express";
import multer from "multer";
import cors from "cors";
import { z } from "zod";
import { parseReceiptWithCatchFallback } from "./receiptParseService.js";
import { listReceipts, saveReceipt } from "./storage.js";
import { normalizeReceiptInput } from "./normalize.js";

loadEnv();
loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const saveBodySchema = z.object({
  merchant: z.string().optional(),
  date: z.string().optional(),
  lineItems: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
  total: z.number().optional(),
  sourceFileName: z.string().optional()
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/receipts", async (_req, res) => {
  const receipts = await listReceipts();
  res.json({ receipts });
});

app.post("/parse-receipt", upload.single("receipt"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded. Use form field 'receipt'." });
  }

  if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
    return res.status(400).json({ error: "Only JPG/PNG files are supported." });
  }

  const result = await parseReceiptWithCatchFallback(file.buffer, file.mimetype);
  return res.json({
    receipt: result.receipt,
    meta: {
      ...result.meta,
      sourceFileName: file.originalname
    }
  });
});

app.post("/save-receipt", async (req, res) => {
  const parsed = saveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const normalized = normalizeReceiptInput(parsed.data);
  const saved = await saveReceipt(normalized, parsed.data.sourceFileName);
  return res.status(201).json({ receipt: saved });
});

app.listen(port, () => {
  console.log(`Receipt parser server running at http://localhost:${port}`);
});
