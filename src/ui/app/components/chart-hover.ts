// The hover for the share chart. A multi-line chart is unreadable without
// one: the question is always "who was where at this point", and that cannot
// be answered by looking at six lines crossing.

function tipFor(rows: string): string {
  return rows.split(";").map((row) => {
    const [target, ink, name, value] = row.split("|");
    return `<span class="ch-tip-row${target === "1" ? " is-you" : ""}">`
      + `<i style="background:${ink}"></i><span class="ch-tip-name">${name}</span>`
      + `<span class="ch-tip-value">${value}</span></span>`;
  }).join("");
}

export function wireChartHover(): void {
  const hide = (wrap: Element) => {
    const tip = wrap.querySelector(".ch-tip");
    const cross = wrap.querySelector(".ch-cross");
    if (tip) tip.setAttribute("hidden", "");
    if (cross) cross.setAttribute("opacity", "0");
  };

  document.addEventListener("pointerover", (event) => {
    const hit = event.target instanceof Element ? event.target.closest(".ch-hit") : null;
    if (!hit) return;
    const wrap = hit.closest(".ch-wrap");
    const tip = wrap ? wrap.querySelector(".ch-tip") : null;
    const svg = wrap ? wrap.querySelector(".ch") : null;
    const cross = wrap ? wrap.querySelector(".ch-cross") : null;
    if (!wrap || !tip || !svg) return;

    // The crosshair is in the svg's own coordinates; the tooltip is in the
    // page's, so each is placed in the space it lives in.
    const centre = Number(hit.getAttribute("x") || 0) + Number(hit.getAttribute("width") || 0) / 2;
    if (cross) {
      cross.setAttribute("x1", String(centre));
      cross.setAttribute("x2", String(centre));
      cross.setAttribute("opacity", "1");
    }
    tip.innerHTML = `<strong class="ch-tip-when">${hit.getAttribute("data-when") || ""}</strong>`
      + tipFor(hit.getAttribute("data-rows") || "");
    tip.removeAttribute("hidden");

    const box = svg.getBoundingClientRect();
    const scale = box.width / 760;
    const left = centre * scale;
    // Flip to the other side near the right edge rather than overflow.
    (tip as HTMLElement).style.left = left > box.width * 0.6 ? "auto" : `${Math.round(left + 14)}px`;
    (tip as HTMLElement).style.right = left > box.width * 0.6 ? `${Math.round(box.width - left + 14)}px` : "auto";
  });

  document.addEventListener("pointerleave", (event) => {
    const wrap = event.target instanceof Element ? event.target.closest(".ch-wrap") : null;
    if (wrap) hide(wrap);
  }, true);
}
