// What the server knows and the browser cannot work out: the brand artwork,
// which is drawn inline so it takes currentColor, and the product's own name.

export interface AppConfig {
  productName: string;
  productTitle: string;
  brandMark: string;
  brandLockup: string;
}

declare global {
  interface Window {
    __citegeo?: AppConfig;
    __citegeoPhase5Active?: boolean;
    __citegeoPhase4?: { render?: () => void; open?: () => Promise<void> };
  }
}

/** Absent means the shell did not render it, which is a broken page rather
 * than a page with no brand, so it fails loudly instead of rendering blank. */
export const CONFIG: AppConfig = (() => {
  const held = typeof window === "undefined" ? undefined : window.__citegeo;
  if (!held) throw new Error("The application shell did not provide its configuration.");
  return held;
})();
