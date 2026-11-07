/**
 * Zástupný vzhled Omalovánek (#88) ve stylu Apple (varianta A3 jako
 * tlačítka čísel v Počítání). Všechny barvy na jednom místě, scény je jen
 * používají. Odstíny barev palety jsou v `palette.ts`.
 */

import { BLUE, TEXT, WHITE } from '../../../shared/logic/theme';

/** Plocha omalovánky: bílé pozadí, tmavý obrys (stejný jako v SVG obrázku) a jemný rámeček. */
export const PICTURE_STYLE = {
  background: WHITE,
  outlineColor: TEXT,
  frameColor: '#D2D2D7',
  frameWidthCss: 2,
} as const;

/** Tlačítko barvy: světle modrý čtverec s okrajem a uprostřed kolečko barvy. */
export const COLOR_BUTTON_STYLE = {
  background: '#E5F0FF',
  borderColor: '#B8D6FF',
  borderWidthCss: 2,
  /** Označená barva má silný modrý okraj. */
  selectedBorderColor: BLUE,
  selectedBorderWidthCss: 5,
  /** Zaoblení rohů jako díl strany tlačítka. */
  cornerRadiusShare: 0.22,
  /** Průměr kolečka barvy jako díl strany tlačítka. */
  swatchShare: 0.64,
} as const;

/** '#RRGGBB' → [červená, zelená, modrá] 0 až 255. */
export function rgbOf(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Tlačítko Zpět (#89): zástupně jako tlačítko barvy, uprostřed modrá šipka zpět. */
export const UNDO_BUTTON_STYLE = {
  background: COLOR_BUTTON_STYLE.background,
  borderColor: COLOR_BUTTON_STYLE.borderColor,
  borderWidthCss: COLOR_BUTTON_STYLE.borderWidthCss,
  cornerRadiusShare: COLOR_BUTTON_STYLE.cornerRadiusShare,
  symbolColor: BLUE,
  /** Šířka čáry šipky jako díl strany tlačítka. */
  symbolLineShare: 0.09,
  /** Poloměr oblouku šipky jako díl strany tlačítka. */
  symbolRadiusShare: 0.22,
} as const;
