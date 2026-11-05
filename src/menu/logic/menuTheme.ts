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
} as const;

/** Tloušťa šedého čárkovaného okraje zástupného tlačítka v CSS px. */
export const PLACEHOLDER_BORDER_WIDTH = 2;
