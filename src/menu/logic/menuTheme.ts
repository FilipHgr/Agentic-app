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
  /** Profil (#71): bílý podklad jako tlačítko jazyka, bílé písmeno, tmavá přezdívka. */
  profileBackground: WHITE,
  profileSymbol: WHITE,
  profileNickname: TEXT,
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

/**
 * Výběr profilu a formulář nového profilu (#72) podle obrázků 4–7 v barvách
 * A3: šedé „+“, bílé klávesy, modrý přepínač vrstvy, šedé zpět a modré →.
 */
export const PROFILE_SCREEN_STYLE = {
  symbol: WHITE,
  nickname: TEXT,
  addBackground: '#C7C7CC',
  addSymbol: WHITE,
  holdRing: BLUE,
  /**
   * Kroužek podržení kolečka profilu (#73): bílý s jemným tmavým okrajem,
   * aby byl vidět na všech barvách palety.
   */
  profileHoldRing: WHITE,
  profileHoldRingOutline: TEXT,
  profileHoldRingOutlineAlpha: 0.35,
  title: TEXT,
  stepCounter: '#6E6E73',
  keyBackground: WHITE,
  keyText: TEXT,
  keyShadowAlpha: 0.1,
  switchBackground: '#E5F0FF',
  switchBorder: '#B8D6FF',
  switchText: BLUE,
  backspaceBackground: '#E8E8ED',
  fieldBackground: WHITE,
  fieldBorder: '#D2D2D7',
  fieldText: TEXT,
  caret: BLUE,
  backBackground: '#E8E8ED',
  backSymbol: TEXT,
  forwardBackground: BLUE,
  /** Ztlumené →, dokud přezdívka nejde uložit. */
  forwardDimmedBackground: '#B8D6FF',
  forwardSymbol: WHITE,
  selectedSwatchRing: TEXT,
  /** Mezera mezi zvolenou barvou a jejím kroužkem. */
  swatchGap: WHITE,
  swatchCheck: WHITE,
  /** Tužka u profilu (#107): světle modré kolečko s okrajem a modrá tužka. */
  pencilBackground: '#E5F0FF',
  pencilBorder: '#B8D6FF',
  pencilSymbol: BLUE,
  /** Koš v úpravě profilu (#73, obrázek 6): světle červené kolečko, červený koš. */
  trashBackground: '#FFE5E7',
  trashSymbol: '#D70015',
  /** Potvrzení smazání (#73, obrázek 8): ztmavený formulář pod bílým rámečkem. */
  dimAlpha: 0.35,
  confirmPanelBackground: WHITE,
  confirmPanelShadowAlpha: 0.12,
  confirmNickname: '#6E6E73',
  confirmQuestion: TEXT,
  /** „Smazat“: červené tlačítko s bílým textem (kontrast 5 : 1). */
  confirmDeleteBackground: '#D70015',
  confirmDeleteText: WHITE,
  /** „Zpět“: šedé tlačítko jako zpět ve formuláři. */
  cancelDeleteBackground: '#E8E8ED',
  cancelDeleteText: TEXT,
} as const;
