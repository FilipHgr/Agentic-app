/**
 * Hloubky vrstev karty s mapou postupu (Phaser `setDepth`) ve hrách
 * s hvězdičkami (#193), aby šlo bez prohlížeče ověřit, co leží nad čím.
 * Čistý TypeScript bez Phaseru.
 *
 * Příklad, hvězdičky a ovládání hry mají výchozí hloubku 0. Panely rodičů
 * (nastavení a průvodce) mají ve hrách vlastní hloubku nad vším
 * (`PANEL_DEPTH` v `scenes/SettingsPanel.ts` hry).
 */

/** Karta s mapou a ztmavení pod ní leží nad příkladem i řadou hvězdiček, pod panely rodičů. */
export const MAP_DEPTH = 20;

/**
 * Nad kartou s mapou: konfety oslavy doběhnou přes okno a hvězdičky
 * z řady do něj přiletí (#154 AC1, AC3). Pořád pod panely rodičů.
 */
export const ABOVE_MAP_DEPTH = MAP_DEPTH + 5;
