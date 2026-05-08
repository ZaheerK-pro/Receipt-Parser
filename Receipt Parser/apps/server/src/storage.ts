import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Receipt } from "./types.js";

export type StoredReceipt = {
  id: string;
  createdAt: string;
  sourceFileName?: string;
  data: Receipt;
};

type StorageFile = {
  receipts: StoredReceipt[];
};

const dataDir = join(process.cwd(), "data");
const dataFile = join(dataDir, "receipts.json");

async function readStorage(): Promise<StorageFile> {
  try {
    const raw = await readFile(dataFile, "utf-8");
    const parsed = JSON.parse(raw) as StorageFile;
    return { receipts: parsed.receipts ?? [] };
  } catch {
    return { receipts: [] };
  }
}

async function writeStorage(content: StorageFile): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(content, null, 2), "utf-8");
}

export async function saveReceipt(receipt: Receipt, sourceFileName?: string): Promise<StoredReceipt> {
  const storage = await readStorage();
  const row: StoredReceipt = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    sourceFileName,
    data: receipt
  };
  storage.receipts.unshift(row);
  await writeStorage(storage);
  return row;
}

export async function listReceipts(): Promise<StoredReceipt[]> {
  const storage = await readStorage();
  return storage.receipts;
}
