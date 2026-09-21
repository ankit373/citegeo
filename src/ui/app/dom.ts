// The few DOM helpers every component needs. Kept apart so a component can be
// unit tested without pulling the whole application in.

/** Escapes text for interpolation into markup. Everything a component writes
 * goes through it: one omission is a cross-site scripting hole. */
export function html(value: unknown): string {
  return String(value === null || value === undefined ? "" : value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

export function attr(name: string, value: unknown): string {
  return `${name}="${html(value)}"`;
}

/** Joins markup fragments, dropping the empty ones so a caller can write a
 * conditional inline without leaving a gap in the output. */
export function join(parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join("");
}

export function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element ${id}`);
  return found;
}

export function closestAttr(target: EventTarget | null, name: string): Element | null {
  return target instanceof Element ? target.closest(`[${name}]`) : null;
}

export function attrValue(target: EventTarget | null, name: string): string | null {
  const found = closestAttr(target, name);
  return found ? found.getAttribute(name) : null;
}
