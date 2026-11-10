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
 * Tlačítka s ikonou Noto Emoji (#126): fotoaparát v malování a kniha na
 * výběru mají podklad a okraj jako Zpět a ikonu uprostřed.
 */
export const ICON_BUTTON_STYLE = {
  ...UNDO_BUTTON_STYLE,
  /** Ikona zabere tento díl strany tlačítka (jako ikona nástroje v panelu). */
  iconShare: 0.66,
  /** Zhoupnutí jako u Zpět: úhel ve stupních a čas jedné čtvrtiny v ms. */
  wobbleAngle: 8,
  wobbleMs: 90,
} as const;

/**
 * Animace uložení do alba (#126, schválené obrázky): bílý záblesk přes
 * obrázek a stisknutí fotoaparátu, pak se fotka s bílým okrajem zmenší
 * a odletí po oblouku do fotoaparátu, který poskočí. Časy jsou díly
 * celé animace.
 */
export const CAMERA_PHOTO_STYLE = {
  durationMs: 950,
  flashColor: '#FFFFFF',
  flashAlpha: 0.9,
  /** Záblesk dohasne do tohoto dílu animace. */
  flashEnd: 0.14,
  /** Fotoaparát je stisknutý do tohoto dílu animace. */
  pressEnd: 0.1,
  pressScale: 0.9,
  /** Zmenšování fotky trvá od `shrinkStart` do `flyStart`, pak fotka letí. */
  shrinkStart: 0.12,
  flyStart: 0.55,
  /** Fotka po zmenšení: díl velikosti obrázku a natočení ve stupních. */
  shrunkScale: 0.42,
  shrunkAngle: -6,
  /** Natočení fotky u fotoaparátu. */
  landedAngle: -14,
  /** Výška oblouku letu jako díl výšky obrázku. */
  arcShare: 0.12,
  /** Fotka zmizí v posledním dílu letu. */
  fadeShare: 0.15,
  /** Bílý okraj fotky a zaoblení v CSS px. */
  borderCss: 6,
  cornerCss: 10,
  /** Stín fotky: rozptyl v CSS px, posun dolů a průhlednost. */
  shadowSpreadsCss: [2, 6, 12],
  shadowOffsetCss: 4,
  shadowAlpha: 0.06,
  /** Poskočení fotoaparátu po doletu. */
  bounceScale: 1.1,
  bounceMs: 120,
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
  /** Prolnutí kroku nástrojů a kroku barev trvá nejvýš 0,2 s (#105 AC7). */
  stepFadeMs: 160,
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

/**
 * Vlnka na tlačítkách tloušťky (#112 AC1, AC3): u gumy a duhy tmavá jako
 * text. Barvu se slabým kontrastem vůči pozadí tlačítka obepíná tmavý
 * obrys (v CSS px, kreslí se vně čáry).
 */
export const LINE_SIZE_WAVE_STYLE = {
  neutralColor: TEXT,
  outlineColor: TEXT,
  outlineWidthCss: 1.5,
} as const;

/**
 * Kolečko barvy v úchytu (#106): vybraná barva s bílým lemem a šedou
 * linkou vně výplně (v CSS px), aby bylo vidět i ve žluté a bílé. Linka má
 * kontrast aspoň 3 : 1 vůči pozadí úchytu i bílému lemu. Guma má kolečko
 * bílé s čárkovanou linkou (délka čárky v CSS px).
 */
export const HANDLE_COLOR_DOT_STYLE = {
  rimColor: WHITE,
  rimCss: 2,
  lineColor: '#767676',
  lineCss: 1,
  eraserFill: WHITE,
  eraserDashCss: 3,
} as const;

/** Lesk třpytek během tahu (#103): bílé jiskry s jemným šedým okrajem. */
export const GLITTER_STYLE = {
  shineColor: WHITE,
  /** Jemný okraj bílého lesku, aby byl vidět i na bílé ploše. */
  shineOutline: '#C7C7CC',
} as const;

/**
 * Dlaždice náhledu na výběru omalovánky (#124): bílá se zaoblením a jemným
 * stínem jako dlaždice v menu, obrázek přes celou dlaždici.
 */
export const PICKER_TILE_STYLE = {
  background: WHITE,
  /** Stín: dvě větší průsvitné plochy posunuté dolů (jako v menu). */
  shadowSpreadsCss: [4, 1.5],
  shadowOffsetCss: 2,
  shadowAlpha: 0.03,
  /** Zhoupnutí po ťuknutí jako u tlačítek v menu. */
  wobbleAngle: 4,
  wobbleMs: 90,
} as const;
