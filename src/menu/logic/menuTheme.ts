/**
 * Barvy menu podle obrázku B ve stylu A3 (#52, #67). Společné barvy
 * stránky jsou v `src/shared/logic/theme.ts`.
 */

import { BLUE, TEXT, WHITE } from '../../shared/logic/theme';

export const MENU_STYLE = {
  tileBackground: WHITE,
  tileSymbolColor: TEXT,
  /** Název hry pod symbolem: tlumená šedá, na bílé 5 : 1. */
  tileTitleColor: '#6E6E73',
  /** Jemný stín dlaždice (černá s malou průhledností). */
  tileShadowAlpha: 0.03,
  categoryBackground: WHITE,
  categoryText: TEXT,
  selectedCategoryBackground: BLUE,
  selectedCategoryText: WHITE,
  placeholderBorder: '#C7C7CC',
  placeholderSymbol: '#AEAEB2',
  /** Tlačítko jazyka (#70): plné bílé kolečko se stínem jako na obrázku B. */
  languageButtonBackground: WHITE,
  languageButtonText: '#6E6E73',
  languageButtonShadowAlpha: 0.06,
  /** Panel nabídky jazyků: bílá karta se stínem nad mřížkou. */
  languagePanelBackground: WHITE,
  languagePanelShadowAlpha: 0.08,
  languageText: TEXT,
  /** Aktuální jazyk: světle modrý řádek, modrý text a ✓ (barvy z A3). */
  selectedLanguageBackground: '#E5F0FF',
  selectedLanguageText: BLUE,
} as const;

/** Tloušťa šedého čárkovaného okraje zástupného tlačítka v CSS px. */
export const PLACEHOLDER_BORDER_WIDTH = 2;
