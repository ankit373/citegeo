// What happened, where the reader was looking. A page prints its outcome in a
// box under the heading, which on a five screen page is nowhere near the click.

export type ToastKind = "success" | "error";

const HOST = "toast-host";
// Three is what fits without covering the page it is reporting on.
const LIMIT = 3;
const LINGER = 5000;

function host(): HTMLElement {
  const found = document.getElementById(HOST);
  if (found) return found;
  const made = document.createElement("div");
  made.id = HOST;
  made.className = "toasts";
  // A failure interrupts and a confirmation waits its turn, so each politeness
  // needs its own region. Both lay out as one stack.
  for (const live of ["polite", "assertive"]) {
    const region = document.createElement("div");
    region.setAttribute("aria-live", live);
    region.setAttribute("data-live", live);
    made.appendChild(region);
  }
  // Outside the application root, which is replaced whole on every render.
  document.body.appendChild(made);
  return made;
}

function dismiss(node: HTMLElement): void {
  node.classList.add("is-going");
  window.setTimeout(() => node.remove(), 200);
}

function oldest(where: HTMLElement): HTMLElement | null {
  const all = where.querySelectorAll(".toast");
  return all.length ? (all[0] as HTMLElement) : null;
}

/** A confirmation says itself and goes. A failure stays until it is read. */
export function toast(input: { text: string; kind?: ToastKind }): void {
  const text = (input.text || "").trim();
  if (!text) return;
  const kind: ToastKind = input.kind === "error" ? "error" : "success";
  const where = host();
  while (where.querySelectorAll(".toast").length >= LIMIT) {
    const first = oldest(where);
    if (!first) break;
    first.remove();
  }
  const region = where.querySelector('[data-live="' + (kind === "error" ? "assertive" : "polite") + '"]');
  if (!region) return;

  const node = document.createElement("div");
  node.className = "toast is-" + kind;
  const line = document.createElement("span");
  line.textContent = text;
  node.appendChild(line);

  const shut = document.createElement("button");
  shut.type = "button";
  shut.className = "toast-shut";
  shut.setAttribute("aria-label", "Dismiss this message");
  shut.textContent = "×";
  shut.addEventListener("click", () => dismiss(node));
  node.appendChild(shut);

  region.appendChild(node);
  // A failure is left for the reader to dismiss, because a message that
  // disappears before it is read is the same as no message.
  if (kind === "success") window.setTimeout(() => dismiss(node), LINGER);
}

/** Clears everything on screen. For a page change, where the outcome of the
 * page being left is no longer what the reader is looking at. */
export function clearToasts(): void {
  const found = document.getElementById(HOST);
  if (!found) return;
  const all = found.querySelectorAll(".toast");
  all.forEach((node) => { node.remove(); });
}
