/**
 * Hloubky vrstev herní obrazovky Počítání (Phaser `setDepth`), aby šlo bez
 * prohlížeče ověřit, co leží nad čím. Čistý TypeScript bez Phaseru.
 *
 * Příklad, hvězdičky, číselník, okénka a nápověda mají výchozí hloubku 0.
 * Panely rodičů (nastavení a průvodce) mají vlastní hloubku nad vším
 * (`PANEL_DEPTH` ve `scenes/SettingsPanel.ts`).
 */

/** Karta s mapou a ztmavení pod ní leží nad příkladem i řadou hvězdiček, pod panely rodičů. */
export const MAP_DEPTH = 20;

/**
 * Nad kartou s mapou: konfety oslavy doběhnou přes okno a hvězdičky
 * z řady do něj přiletí (#154 AC1, AC3). Pořád pod panely rodičů.
 */
export const ABOVE_MAP_DEPTH = MAP_DEPTH + 5;
