/**
 * Společné barvy a písmo stránky ve stylu Apple (#52, varianta A3) pro
 * všechny hry a kontrast podle WCAG. Styly jednotlivých her mají hry samy.
 */

/** Pozadí stránky i herní plochy. */
export const PAGE_BACKGROUND = '#F5F5F7';

/** Systémové písmo: na iPadu SF Pro, jinde náhradní; nic se nestahuje. */
export const FONT_FAMILY =
  '-apple-system, "SF Pro Rounded", "Helvetica Neue", system-ui, sans-serif';

export const TEXT = '#1D1D1F';
export const SECONDARY = '#86868B';
export const BLUE = '#0062CC';
export const SUCCESS_GREEN = '#248A3D';
export const WHITE = '#FFFFFF';

export const SETTINGS_GEAR_STYLE = {
  color: SECONDARY,
  centerColor: PAGE_BACKGROUND,
  holdRingColor: BLUE,
} as const;

/** '#F5F5F7' → 0xf5f5f7 pro Phaser. */
export function colorNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** Kontrastní poměr dvou barev podle WCAG 2.x (1 až 21). */
export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const value = colorNumber(hex);
  const [red, green, blue] = [16, 8, 0].map((shift) =>
    linearChannel(((value >> shift) & 0xff) / 255),
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function linearChannel(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
