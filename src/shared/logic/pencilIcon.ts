/**
 * Tužka ve volbě psaní v nastavení pro rodiče (#41, od #188 sdílená pro
 * všechny hry s psaním prstem), kreslená čarou (nezávisí na písmu).
 * Souřadnice jsou vůči středu volby, osa y míří dolů; hrot je vlevo dole
 * jako při psaní. Čistý TypeScript bez Phaseru.
 */
export const PENCIL_ICON = {
  width: 72,
  height: 72,
  strokeWidth: 10,
  tip: { x: -30, y: 30 },
  tail: { x: 30, y: -30 },
} as const;
