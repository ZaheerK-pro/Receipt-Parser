export function bindDropZone(
  dropZone: HTMLElement | null,
  fileInput: HTMLInputElement | null,
  isParsing: boolean
): void {
  if (!dropZone || !fileInput) return;

  const setDragging = (on: boolean) => {
    dropZone.classList.toggle("drag-active", on);
  };

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    setDragging(true);
  });
  dropZone.addEventListener("dragleave", () => setDragging(false));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  dropZone.addEventListener("click", () => {
    if (!isParsing) fileInput.click();
  });
  dropZone.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !isParsing) {
      e.preventDefault();
      fileInput.click();
    }
  });
}
