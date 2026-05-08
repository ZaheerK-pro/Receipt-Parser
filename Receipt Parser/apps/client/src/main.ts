import "./style.css";
import { fetchListReceipts, fetchParseReceipt, fetchSaveReceipt, parseTimeoutMs } from "./lib/api.js";
import { PAGE_SIZE, SUPPORTED_IMAGE_TYPES } from "./lib/constants.js";
import { emptyReceipt, filterReceiptsBySearch, statusAfterSuccessfulParse } from "./lib/receiptDomain.js";
import type { AppState, ParseMeta } from "./lib/types.js";
import { bindDropZone } from "./ui/dropZone.js";
import { renderApp } from "./ui/render.js";
import { showToast } from "./ui/toast.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
const toastRoot = document.querySelector<HTMLDivElement>("#toast-root")!;

const state: AppState = {
  activeTab: "parse",
  navOpen: false,
  selectedFile: null,
  selectedFilePreviewUrl: null,
  receipt: null,
  meta: null,
  status: "",
  savedMessage: "",
  savedReceipts: [],
  savedTabStatus: "",
  isParsing: false,
  statsReady: false,
  previewScale: 1,
  savedSearch: "",
  savedPage: 1
};

function render(): void {
  app.innerHTML = renderApp(state);
  bindEvents();
}

async function loadSavedReceipts(): Promise<void> {
  state.savedTabStatus = "Loading saved receipts...";
  try {
    const result = await fetchListReceipts();
    if (!result.ok) {
      state.savedTabStatus = result.message;
      return;
    }
    state.savedReceipts = result.receipts;
    state.savedTabStatus = "";
  } catch {
    state.savedTabStatus = "Cannot reach server.";
  } finally {
    state.statsReady = true;
  }
}

function bindEvents(): void {
  document.querySelector("#brandLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.activeTab = "parse";
    state.navOpen = false;
    render();
  });

  document.querySelector<HTMLButtonElement>("#navToggle")?.addEventListener("click", () => {
    state.navOpen = !state.navOpen;
    render();
  });

  document.querySelector<HTMLButtonElement>("#tabParseBtn")?.addEventListener("click", () => {
    state.activeTab = "parse";
    state.navOpen = false;
    render();
  });

  document.querySelector<HTMLButtonElement>("#tabSavedBtn")?.addEventListener("click", async () => {
    state.activeTab = "saved";
    state.navOpen = false;
    state.savedPage = 1;
    await loadSavedReceipts();
    render();
  });

  const fileInput = document.querySelector<HTMLInputElement>("#fileInput");
  const dropZone = document.querySelector<HTMLElement>("#dropZone");
  bindDropZone(dropZone ?? null, fileInput ?? null, state.isParsing);

  document.querySelector<HTMLButtonElement>("#browseBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  fileInput?.addEventListener("change", () => {
    const candidate = fileInput.files?.[0] ?? null;
    if (state.selectedFilePreviewUrl) {
      URL.revokeObjectURL(state.selectedFilePreviewUrl);
      state.selectedFilePreviewUrl = null;
    }
    state.selectedFile = candidate;
    if (candidate) {
      state.selectedFilePreviewUrl = URL.createObjectURL(candidate);
    }
    state.savedMessage = "";
    render();
  });

  document.querySelector<HTMLButtonElement>("#parseBtn")?.addEventListener("click", () => void runParse());
  document.querySelector<HTMLButtonElement>("#fabUpload")?.addEventListener("click", () => fileInput?.click());
  document.querySelector<HTMLButtonElement>("#goParseBtn")?.addEventListener("click", () => {
    state.activeTab = "parse";
    render();
  });

  document.querySelector<HTMLButtonElement>("#zoomIn")?.addEventListener("click", () => {
    state.previewScale = Math.min(2.5, state.previewScale + 0.15);
    render();
  });
  document.querySelector<HTMLButtonElement>("#zoomOut")?.addEventListener("click", () => {
    state.previewScale = Math.max(0.5, state.previewScale - 0.15);
    render();
  });
  document.querySelector<HTMLButtonElement>("#zoomReset")?.addEventListener("click", () => {
    state.previewScale = 1;
    render();
  });

  document.querySelector<HTMLInputElement>("#savedSearch")?.addEventListener("input", (e) => {
    state.savedSearch = (e.target as HTMLInputElement).value;
    state.savedPage = 1;
    render();
  });

  document.querySelector<HTMLButtonElement>("#pagePrev")?.addEventListener("click", () => {
    state.savedPage = Math.max(1, state.savedPage - 1);
    render();
  });
  document.querySelector<HTMLButtonElement>("#pageNext")?.addEventListener("click", () => {
    const filtered = filterReceiptsBySearch(state.savedReceipts, state.savedSearch);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.savedPage = Math.min(totalPages, state.savedPage + 1);
    render();
  });

  document.querySelector<HTMLButtonElement>("#saveBtn")?.addEventListener("click", () => void runSave());
  document.querySelector<HTMLButtonElement>("#addItemBtn")?.addEventListener("click", () => {
    if (!state.receipt) return;
    state.receipt.lineItems.push({ name: "", amount: 0 });
    render();
  });

  document.querySelectorAll<HTMLInputElement>("[data-item-name]").forEach((el) => {
    el.addEventListener("input", () => {
      if (!state.receipt) return;
      const idx = Number(el.dataset.itemName);
      state.receipt.lineItems[idx].name = el.value;
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-item-amount]").forEach((el) => {
    el.addEventListener("input", () => {
      if (!state.receipt) return;
      const idx = Number(el.dataset.itemAmount);
      state.receipt.lineItems[idx].amount = Number(el.value || 0);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-remove-item]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!state.receipt) return;
      const idx = Number(el.dataset.removeItem);
      state.receipt.lineItems.splice(idx, 1);
      render();
    });
  });

  const merchant = document.querySelector<HTMLInputElement>("#merchant");
  merchant?.addEventListener("input", () => {
    if (state.receipt) state.receipt.merchant = merchant.value;
  });
  const date = document.querySelector<HTMLInputElement>("#date");
  date?.addEventListener("input", () => {
    if (state.receipt) state.receipt.date = date.value;
  });
  const total = document.querySelector<HTMLInputElement>("#total");
  total?.addEventListener("input", () => {
    if (state.receipt) state.receipt.total = Number(total.value || 0);
  });
}

function fallbackMeta(warning: string): ParseMeta {
  return {
    warnings: [warning],
    confidenceHints: ["merchant", "date", "lineItems", "total"],
    model: "n/a",
    attempts: 0
  };
}

async function runParse(): Promise<void> {
  if (!state.selectedFile) return;
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(state.selectedFile.type)) {
    state.status = "Only JPG and PNG are supported for parsing right now.";
    showToast(toastRoot, state.status);
    render();
    return;
  }

  state.isParsing = true;
  state.status = "Parsing receipt…";
  state.savedMessage = "";
  render();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeoutMs());
  const result = await fetchParseReceipt(state.selectedFile, controller.signal);
  clearTimeout(timeout);
  state.isParsing = false;

  if (!result.ok) {
    if (result.error === "network") {
      state.status = `Parsing timed out or failed after ${Math.round(parseTimeoutMs() / 1000)}s. Check server and try again.`;
      state.receipt = emptyReceipt();
      state.meta = fallbackMeta(`No response within ${Math.round(parseTimeoutMs() / 1000)} seconds.`);
    } else {
      state.status = result.error;
      state.receipt = emptyReceipt();
      state.meta = fallbackMeta(String(result.details ?? "Fix fields manually."));
    }
    showToast(toastRoot, "Parse failed — check connection");
    render();
    return;
  }

  state.receipt = result.receipt;
  state.meta = result.meta;
  state.status = statusAfterSuccessfulParse(result.meta);
  showToast(toastRoot, "Receipt parsed");
  render();
}

async function runSave(): Promise<void> {
  if (!state.receipt) return;
  const payload = { ...state.receipt, sourceFileName: state.meta?.sourceFileName };
  const result = await fetchSaveReceipt(payload as Record<string, unknown>);
  if (!result.ok) {
    state.savedMessage = result.message;
    showToast(toastRoot, state.savedMessage);
    render();
    return;
  }
  state.savedMessage = `Saved receipt ${result.id}`;
  await loadSavedReceipts();
  state.status = "";
  showToast(toastRoot, "Receipt saved");
  render();
}

state.statsReady = false;
void loadSavedReceipts().then(() => render());
render();
