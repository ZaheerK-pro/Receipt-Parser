export type LineItem = { name: string; amount: number };

export type Receipt = { merchant: string; date: string; lineItems: LineItem[]; total: number };

export type StoredReceipt = {
  id: string;
  createdAt: string;
  sourceFileName?: string;
  data: Receipt;
};

export type ParseMeta = {
  warnings: string[];
  confidenceHints: string[];
  sourceFileName?: string;
  model: string;
  attempts: number;
};

export type AppState = {
  activeTab: "parse" | "saved";
  navOpen: boolean;
  selectedFile: File | null;
  selectedFilePreviewUrl: string | null;
  receipt: Receipt | null;
  meta: ParseMeta | null;
  status: string;
  savedMessage: string;
  savedReceipts: StoredReceipt[];
  savedTabStatus: string;
  isParsing: boolean;
  statsReady: boolean;
  previewScale: number;
  savedSearch: string;
  savedPage: number;
};
