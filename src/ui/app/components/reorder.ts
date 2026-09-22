// Panels the reader can rearrange. The order is theirs, not the product's, so
// it lives in their browser and never travels anywhere.

const REMEMBERED = "citegeo.dashboard.panels";

/** Reads the saved order. Unknown ids are dropped and new ones appended, so
 * adding a panel does not strand it and removing one does not break the rest. */
export function panelOrder(known: string[]): string[] {
  let saved: string[] = [];
  try {
    const raw = localStorage.getItem(REMEMBERED);
    if (raw) saved = JSON.parse(raw) as string[];
  } catch (error) {
    saved = [];
  }
  const kept = saved.filter((id) => known.includes(id));
  return [...kept, ...known.filter((id) => !kept.includes(id))];
}

function remember(order: string[]): void {
  try {
    localStorage.setItem(REMEMBERED, JSON.stringify(order));
  } catch (error) {
    /* the arrangement just will not persist */
  }
}

export function resetPanelOrder(): void {
  try {
    localStorage.removeItem(REMEMBERED);
  } catch (error) {
    /* nothing was stored */
  }
}

export function hasPanelOrder(): boolean {
  try {
    return Boolean(localStorage.getItem(REMEMBERED));
  } catch (error) {
    return false;
  }
}

function idsIn(grid: Element): string[] {
  return Array.from(grid.children)
    .map((child) => child.getAttribute("data-panel") || "")
    .filter(Boolean);
}

/** Drag to rearrange, once, for the whole grid. Delegated from the document
 * because the grid is replaced on every render. */
export function wirePanelDrag(onChange: () => void): void {
  let dragging: HTMLElement | null = null;

  document.addEventListener("dragstart", (event) => {
    const panel = event.target instanceof Element ? event.target.closest("[data-panel]") : null;
    if (!panel) return;
    dragging = panel as HTMLElement;
    panel.classList.add("is-dragging");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragend", () => {
    if (dragging) dragging.classList.remove("is-dragging");
    dragging = null;
    document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  });

  document.addEventListener("dragover", (event) => {
    if (!dragging) return;
    const over = event.target instanceof Element ? event.target.closest("[data-panel]") : null;
    if (!over || over === dragging || over.parentElement !== dragging.parentElement) return;
    event.preventDefault();
    document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    over.classList.add("is-drop-target");
  });

  document.addEventListener("drop", (event) => {
    if (!dragging) return;
    const over = event.target instanceof Element ? event.target.closest("[data-panel]") : null;
    if (!over || over === dragging || over.parentElement !== dragging.parentElement) return;
    event.preventDefault();
    const grid = over.parentElement as Element;
    // Before or after, decided by which half of the target was dropped on.
    const box = over.getBoundingClientRect();
    const after = (event as DragEvent).clientY > box.top + box.height / 2;
    grid.insertBefore(dragging, after ? over.nextSibling : over);
    remember(idsIn(grid));
    onChange();
  });
}
