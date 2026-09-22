// Panels the reader can rearrange. The order is theirs, not the product's, so
// it lives in their browser and never travels anywhere.

const REMEMBERED = "citegeo.dashboard.panels";

export interface PanelLayout {
  order: string[];
  /** Tracks a panel spans: 1, 2, or 0 for the whole row. */
  spans: Record<string, number>;
  hidden: string[];
}

function stored(): PanelLayout {
  const empty: PanelLayout = { order: [], spans: {}, hidden: [] };
  try {
    const raw = localStorage.getItem(REMEMBERED);
    if (!raw) return empty;
    const held = JSON.parse(raw) as unknown;
    // The first version of this stored a bare array of ids. A reader who
    // arranged their board then is not made to arrange it again.
    if (Array.isArray(held)) return { order: held as string[], spans: {}, hidden: [] };
    const object = held as Partial<PanelLayout>;
    return {
      order: Array.isArray(object.order) ? object.order : [],
      spans: object.spans && typeof object.spans === "object" ? object.spans : {},
      hidden: Array.isArray(object.hidden) ? object.hidden : [],
    };
  } catch (error) {
    return empty;
  }
}

function remember(layout: PanelLayout): void {
  try {
    localStorage.setItem(REMEMBERED, JSON.stringify(layout));
  } catch (error) {
    /* the arrangement just will not persist */
  }
}

/** The saved layout reconciled with the panels that exist. Unknown ids are
 * dropped and new ones appended, so a new panel is never stranded. */
export function panelLayout(known: string[]): PanelLayout {
  const held = stored();
  const kept = held.order.filter((id) => known.includes(id));
  return {
    order: [...kept, ...known.filter((id) => !kept.includes(id))],
    spans: held.spans,
    hidden: held.hidden.filter((id) => known.includes(id)),
  };
}

/** The order alone, for callers that do not arrange anything. */
export function panelOrder(known: string[]): string[] {
  return panelLayout(known).order;
}

/** 1 track, 2 tracks, or the whole row. Anything else is ignored rather than
 * written, because a stored width nobody can undo is worse than none. */
export function setPanelSpan(id: string, span: number): void {
  if (span !== 0 && span !== 1 && span !== 2) return;
  const held = stored();
  held.spans[id] = span;
  remember(held);
}

export function togglePanelHidden(id: string): void {
  const held = stored();
  const at = held.hidden.indexOf(id);
  if (at >= 0) held.hidden.splice(at, 1); else held.hidden.push(id);
  remember(held);
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
    const held = stored();
    held.order = idsIn(grid);
    remember(held);
    onChange();
  });
}
