/**
 * Barvy a tloušťky Porovnávání (#178, nastavení #179) ve stylu ostatních her: bílé karty
 * na světlém pozadí, tečky dvou barev (každá karta jiná, obě s kontrastem
 * aspoň 3 : 1 proti bílé) a „=“ jako tlačítka s čísly v Počítání.
 * Čistý TypeScript bez Phaseru.
 */

import { BLUE, PAGE_BACKGROUND, SUCCESS_GREEN, WHITE } from '../../../shared/logic/theme';

export const CARD_STYLE = {
  fill: WHITE,
  border: '#D2D2D7',
  /** Okraj karty po správném ťuknutí. */
  correctBorder: SUCCESS_GREEN,
  /** Tloušťka okraje v CSS px. */
  borderWidth: 2,
  correctBorderWidth: 4,
} as const;

/** Barva teček levé a pravé karty. */
export const DOT_COLORS = ['#0062CC', '#C2410C'] as const;

export const EQUAL_BUTTON_STYLE = {
  fill: '#E5F0FF',
  border: '#B8D6FF',
  borderWidth: 2,
  symbolColor: BLUE,
  fontWeight: 'bold',
} as const;

export const SIGN_STYLE = {
  color: SUCCESS_GREEN,
  fontWeight: 'bold',
} as const;

/** Číslo na kartě (#179): v barvě teček své karty, tučně. */
export const NUMERAL_STYLE = { fontWeight: 'bold' } as const;

// ---------------------------------------------------------------------------
// Nastavení pro rodiče (#179) ve stejném světlém vzhledu jako v Počítání (#53).
// ---------------------------------------------------------------------------

/** Pozadí panelu: stejné jako stránka, neprůhledné, aby ťuknutí nepropadla do hry. */
export const SETTINGS_PANEL_BACKGROUND = PAGE_BACKGROUND;

/** Nevybraná volba jako „=“, vybraná plná modrá s bílým obsahem. */
export const SETTINGS_OPTION_STYLE = {
  unselected: { fill: EQUAL_BUTTON_STYLE.fill, border: EQUAL_BUTTON_STYLE.border, content: BLUE },
  selected: { fill: BLUE, border: BLUE, content: WHITE },
} as const;

/** Popisky řad: druhotná šedá jako popisky skupin v iOS. */
export const SETTINGS_LABEL_COLOR = '#6E6E73';

export const CONFIRM_BUTTON_STYLE = {
  fill: SUCCESS_GREEN,
  tick: WHITE,
  /** Zaoblení a tloušťka fajfky jako díl strany tlačítka. */
  cornerShare: 0.25,
  tickShare: 0.13,
} as const;

/** Kolečko stránky je při otevřeném nastavení ztlumené (#45). */
export const GEAR_OPACITY = { open: 0.3, closed: 1, transitionMs: 150 } as const;
