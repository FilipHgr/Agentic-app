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

/**
 * Panel nástrojů (#96): bílá karta se stínem a zaoblenými rohy, mezi
 * oddílem barev a nástrojů jemná čára. Zástupný vzhled, konečný přijde
 * s ikonami (mimo rozsah #96).
 */
export const TOOL_PANEL_STYLE = {
  background: WHITE,
  cornerRadiusCss: 24,
  dividerColor: '#D2D2D7',
  shadowColor: '#000000',
  /** Stín: několik průsvitných vrstev kolem karty, posunutých dolů. */
  shadowLayers: 5,
  shadowSpreadCss: 3,
  shadowOffsetCss: 4,
  shadowAlpha: 0.035,
  /** Vysunutí a zasunutí trvá nejvýš 0,3 s (#96 AC7). */
  slideMs: 220,
} as const;

/** Prázdné místo pro nehotovou položku: jen slabý obrys bez výplně, nevypadá jako tlačítko. */
export const EMPTY_SLOT_STYLE = {
  borderColor: '#E3E3E8',
  borderWidthCss: 1.5,
  cornerRadiusShare: COLOR_BUTTON_STYLE.cornerRadiusShare,
} as const;

/** Úchyt panelu (#96 AC5): tlačítko A3 s modrým okrajem, štětec ve vybrané barvě a šipka. */
export const HANDLE_STYLE = {
  background: COLOR_BUTTON_STYLE.background,
  borderColor: BLUE,
  borderWidthCss: 3,
  cornerRadiusShare: COLOR_BUTTON_STYLE.cornerRadiusShare,
  arrowColor: BLUE,
} as const;

/** Tečka velikosti čáry (#91) v úchytu i v přepínači: tmavá jako obrys. */
export const SIZE_DOT_STYLE = {
  color: TEXT,
} as const;

/** Štětec: modrá rukojeť, šedomodrá objímka a špička v barvě. */
export const BRUSH_STYLE = {
  handleColor: BLUE,
  ferruleColor: '#6E9FD6',
  /** Štětec bez barvy má špičku šedou. */
  noColor: '#C7C7CC',
} as const;

/** Guma (#90): šikmý kvádr bez barvy, modrý obal jako rukojeť štětce a šedá pryž. */
export const ERASER_STYLE = {
  sleeveColor: BRUSH_STYLE.handleColor,
  rubberColor: BRUSH_STYLE.noColor,
  /** Jemná čára pod gumou, aby bylo vidět, že něco stírá. */
  trailColor: '#D2D2D7',
} as const;

/** Fix (#93): modré tělo, šedomodrý límec, víčko a čtvercový hrot v barvě. */
export const MARKER_STYLE = {
  bodyColor: BRUSH_STYLE.handleColor,
  collarColor: BRUSH_STYLE.ferruleColor,
  noColor: BRUSH_STYLE.noColor,
} as const;

/** Pastelka (#93): tlusté tělo a špičatý hrot v barvě, na obalu modré proužky. */
export const CRAYON_STYLE = {
  stripeColor: BRUSH_STYLE.handleColor,
  noColor: BRUSH_STYLE.noColor,
} as const;

/** Razítkový fix (#98): hvězdičky v barvě, bez barvy šedé jako špička štětce. */
export const STAMP_STYLE = {
  noColor: BRUSH_STYLE.noColor,
} as const;
