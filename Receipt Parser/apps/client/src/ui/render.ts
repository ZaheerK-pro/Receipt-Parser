import { PAGE_SIZE } from "../lib/constants.js";
import { escapeHtml, formatDate, formatMoney } from "../lib/format.js";
import { ICON_LOGO, ICON_MENU, ICON_UPLOAD } from "../lib/icons.js";
import { computeReceiptStats, filterReceiptsBySearch } from "../lib/receiptDomain.js";
import type { AppState } from "../lib/types.js";

function renderStats(state: AppState): string {
  if (!state.statsReady) {
    return `
      <div class="stats-grid">
        ${[1, 2, 3, 4].map(() => `<div class="stat-card skeleton"><div class="stat-label">…</div><div class="stat-value"></div><div class="stat-spark"></div></div>`).join("")}
      </div>`;
  }
  const { totalReceipts, totalAmount, thisMonth, parsedSuccessfully } = computeReceiptStats(state.savedReceipts);
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total receipts</div>
        <div class="stat-value">${totalReceipts}</div>
        <div class="stat-spark"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total amount</div>
        <div class="stat-value">${formatMoney(totalAmount)}</div>
        <div class="stat-spark"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This month</div>
        <div class="stat-value">${formatMoney(thisMonth)}</div>
        <div class="stat-spark"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Parsed successfully</div>
        <div class="stat-value">${parsedSuccessfully}</div>
        <div class="stat-spark"></div>
      </div>
    </div>`;
}

function renderNav(state: AppState): string {
  return `
    <header class="top-nav">
      <a href="#" class="brand" id="brandLink">
        <span class="brand-mark">${ICON_LOGO}</span>
        <span class="brand-text">
          <span class="brand-name">Receipt Parser AI</span>
          <span class="brand-tag">Local intelligence</span>
        </span>
      </a>
      <div class="nav-actions">
        <button type="button" class="nav-toggle" id="navToggle" aria-label="Menu">${ICON_MENU}</button>
        <nav class="nav-links ${state.navOpen ? "open" : ""}" id="navLinks">
          <button type="button" class="nav-tab ${state.activeTab === "parse" ? "active" : ""}" id="tabParseBtn">Parse</button>
          <button type="button" class="nav-tab ${state.activeTab === "saved" ? "active" : ""}" id="tabSavedBtn">Archive</button>
        </nav>
      </div>
    </header>`;
}

function renderHero(): string {
  return `
    <section class="hero-section">
      <span class="hero-badge">AI-powered extraction</span>
      <h1 class="hero-title">Scan. Extract. Organize.</h1>
      <p class="hero-tagline">Premium receipt parsing with editable results, local OCR fallback, and a clean archive.</p>
    </section>`;
}

function renderDropZone(state: AppState): string {
  const fileName = state.selectedFile ? escapeHtml(state.selectedFile.name) : "";
  return `
    <div class="glass-card">
      <h2>Upload receipt</h2>
      <div class="drop-zone" id="dropZone" tabindex="0" role="button" aria-label="Upload receipt file">
        <input type="file" id="fileInput" class="file-input-hidden" accept=".jpg,.jpeg,.png,image/png,image/jpeg" ${state.isParsing ? "disabled" : ""} />
        <div class="drop-zone-icon">${ICON_UPLOAD}</div>
        <p class="drop-zone-title">Drag &amp; drop your receipt</p>
        <p class="drop-zone-hint">${state.selectedFile ? `Selected: <strong>${fileName}</strong>` : "or click to browse files"}</p>
        <span class="drop-zone-formats">JPG · PNG · PDF (PDF parse coming soon)</span>
        <button type="button" class="btn-primary" id="browseBtn" ${state.isParsing ? "disabled" : ""}>Choose file</button>
        ${state.isParsing ? `<div class="upload-progress" aria-hidden="true"><div class="upload-progress-bar"></div></div>` : ""}
      </div>
      <div style="margin-top:16px;text-align:center;">
        <button type="button" class="btn-primary" id="parseBtn" ${state.selectedFile && !state.isParsing ? "" : "disabled"}>
          ${state.isParsing ? "Processing…" : "Parse receipt"}
        </button>
      </div>
    </div>`;
}

function renderProcessingState(state: AppState): string {
  if (!state.isParsing) return "";
  return `
    <div class="processing-banner">
      <div class="spinner" aria-hidden="true"></div>
      <div>
        <h4>Processing your receipt</h4>
        <p>Running extraction. If the cloud API is unavailable, local OCR runs automatically.</p>
      </div>
    </div>`;
}

function renderPreviewPanel(state: AppState): string {
  const hasImage = Boolean(state.selectedFilePreviewUrl);
  return `
    <div class="glass-card preview-panel">
      <h3>Receipt preview</h3>
      <div class="preview-toolbar">
        <button type="button" id="zoomOut" ${!hasImage ? "disabled" : ""}>−</button>
        <button type="button" id="zoomReset" ${!hasImage ? "disabled" : ""}>100%</button>
        <button type="button" id="zoomIn" ${!hasImage ? "disabled" : ""}>+</button>
      </div>
      <div class="preview-frame">
        ${
          hasImage
            ? `<div class="preview-inner" style="transform: scale(${state.previewScale});transform-origin: center center;">
                 <img src="${state.selectedFilePreviewUrl}" alt="Receipt" />
               </div>`
            : `<div class="preview-placeholder">Upload a receipt to preview and zoom scanned areas.</div>`
        }
      </div>
    </div>`;
}

function isUncertain(meta: AppState["meta"], field: string): boolean {
  return Boolean(meta?.confidenceHints?.includes(field));
}

function renderEditor(state: AppState): string {
  if (!state.receipt) return "";
  const { receipt, meta } = state;
  const rows = receipt.lineItems
    .map(
      (item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><input type="text" data-item-name="${idx}" value="${escapeHtml(item.name)}" placeholder="Item" class="${isUncertain(meta, "lineItems") ? "uncertain" : ""}" /></td>
      <td><input type="number" data-item-amount="${idx}" step="0.01" value="${item.amount}" /></td>
      <td><button type="button" class="btn-icon" data-remove-item="${idx}" title="Remove">×</button></td>
    </tr>`
    )
    .join("");

  return `
    <div class="glass-card" style="animation: fadeUp 0.45s ease both;">
      <h2>Extracted data</h2>
      <p class="meta-row">Model: <strong>${escapeHtml(meta?.model ?? "n/a")}</strong> · Attempts: <strong>${meta?.attempts ?? 0}</strong></p>
      <div class="summary-grid">
        <label for="merchant">Merchant</label>
        <input id="merchant" class="field-input ${isUncertain(meta, "merchant") ? "uncertain" : ""}" value="${escapeHtml(receipt.merchant)}" />
        <label for="date">Date</label>
        <input id="date" class="field-input ${isUncertain(meta, "date") ? "uncertain" : ""}" value="${escapeHtml(receipt.date)}" placeholder="YYYY-MM-DD" />
        <label for="total">Total</label>
        <input id="total" class="field-input ${isUncertain(meta, "total") ? "uncertain" : ""}" type="number" step="0.01" value="${receipt.total}" />
      </div>
      <h3>Line items</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:48px">#</th>
              <th>Item</th>
              <th style="width:120px">Amount</th>
              <th style="width:56px"></th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No line items — add rows below.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="table-actions">
        <button type="button" class="btn-secondary" id="addItemBtn">+ Add line</button>
        <button type="button" class="btn-primary" id="saveBtn" style="margin-top:0;">Save receipt</button>
      </div>
    </div>`;
}

function renderParseWorkspace(state: AppState): string {
  return `
    ${renderHero()}
    ${renderStats(state)}
    <div class="workspace">
      <div class="workspace-main">
        ${renderDropZone(state)}
        ${renderProcessingState(state)}
        ${state.status ? `<div class="alert alert-info">${escapeHtml(state.status)}</div>` : ""}
        ${state.meta?.warnings?.length ? `<div class="alert alert-warn">${state.meta.warnings.map((w) => `<div>${escapeHtml(w)}</div>`).join("")}</div>` : ""}
        ${renderEditor(state)}
        ${state.savedMessage ? `<div class="alert alert-info">${escapeHtml(state.savedMessage)}</div>` : ""}
      </div>
      <aside class="workspace-side">
        ${renderPreviewPanel(state)}
      </aside>
    </div>`;
}

function renderSavedArchive(state: AppState): string {
  const filtered = filterReceiptsBySearch(state.savedReceipts, state.savedSearch);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(state.savedPage, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const rows = pageRows
    .map(
      (row) => `
    <tr>
      <td><code style="font-size:0.75rem;">${escapeHtml(row.id.slice(0, 8))}…</code></td>
      <td>${escapeHtml(row.data.merchant || "—")}</td>
      <td>${escapeHtml(row.data.date || "—")}</td>
      <td>${formatMoney(row.data.total)}</td>
      <td>${row.data.lineItems.length}</td>
      <td>${escapeHtml(formatDate(row.createdAt))}</td>
    </tr>`
    )
    .join("");

  return `
    ${renderHero()}
    ${renderStats(state)}
    <div class="glass-card">
      <h2>Receipt archive</h2>
      <p class="meta-row">Search and browse everything saved on this device.</p>
      ${state.savedTabStatus ? `<div class="alert alert-info">${escapeHtml(state.savedTabStatus)}</div>` : ""}
      <div class="archive-toolbar">
        <input type="search" class="search-input" id="savedSearch" placeholder="Search merchant, date, total…" value="${escapeHtml(state.savedSearch)}" />
      </div>
      ${
        filtered.length === 0 && !state.savedTabStatus
          ? `
      <div class="empty-state">
        <div class="empty-illustration">${ICON_LOGO}</div>
        <h3>No saved receipts</h3>
        <p>Parse a receipt and hit Save — it will appear here with full-text search.</p>
        <button type="button" class="btn-primary" id="goParseBtn">Go to parse</button>
      </div>`
          : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Merchant</th>
              <th>Date</th>
              <th>Total</th>
              <th>Items</th>
              <th>Saved</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="pagination">
        <button type="button" class="btn-secondary" id="pagePrev" ${page <= 1 ? "disabled" : ""}>Previous</button>
        <span>Page ${page} / ${totalPages}</span>
        <button type="button" class="btn-secondary" id="pageNext" ${page >= totalPages ? "disabled" : ""}>Next</button>
      </div>`
      }
    </div>`;
}

export function renderApp(state: AppState): string {
  return `
    <div class="app-shell">
      ${renderNav(state)}
      <main class="main-content">
        ${state.activeTab === "parse" ? renderParseWorkspace(state) : renderSavedArchive(state)}
      </main>
      <button type="button" class="fab" id="fabUpload" title="Quick upload" aria-label="Quick upload">+</button>
    </div>`;
}
