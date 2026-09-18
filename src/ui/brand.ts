export const PRODUCT_NAME = "citegeo";
export const PRODUCT_TITLE = "citegeo";
export const CITEGEO_LOCKUP_ASSET = "/assets/brand/citegeo-lockup.svg";

export function renderCiteGeoMarkSvg(className = "citegeo-mark"): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="CiteGEO">
    <title>CiteGEO</title>
    <desc>CiteGEO emblem, a quotation mark</desc>
    <g fill="currentColor">
      <rect x="6" y="7" width="7" height="15" rx="1.5" transform="rotate(-14 9.5 14.5)"/>
      <rect x="18" y="7" width="7" height="15" rx="1.5" transform="rotate(-14 21.5 14.5)"/>
    </g>
  </svg>`;
}

export function renderCiteGeoLockup(className = "citegeo-lockup"): string {
  return `<img class="${className}" src="${CITEGEO_LOCKUP_ASSET}" alt="CiteGEO" width="640" height="160">`;
}
