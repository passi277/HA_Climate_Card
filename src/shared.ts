import { CARD_VERSION } from "./const";

export const PROJECT_NAME = "HA Modern Home Cards";
export const DOCS_URL = "https://github.com/passi277/HA-Modern-Home-Cards";

if (!(window as any).__haModernHomeCards) {
  (window as any).__haModernHomeCards = CARD_VERSION;
  console.info(
    `%c HA MODERN HOME CARDS %c v${CARD_VERSION} `,
    "color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px",
    "color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0",
  );
  // Animierbare Akzentfarbe: Farbwechsel werden weich überblendet statt hart umgeschaltet.
  try {
    (window as any).CSS?.registerProperty?.({ name: "--hcc-accent-c", syntax: "<color>", inherits: true, initialValue: "transparent" });
  } catch {
    /* bereits registriert */
  }
}
