/**
 * Barvy a tloušťky Porovnávání (#187, nastavení #179) ve stylu ostatních
 * her: tmavá velká čísla na světlém pozadí, bílé okénko s šedým okrajem,
 * po správné odpovědi zelené, a tlačítka + a − jako tlačítka s čísly
 * v Počítání. Čistý TypeScript bez Phaseru.
 */

import { BLUE, PAGE_BACKGROUND, SUCCESS_GREEN, TEXT, WHITE } from '../../../shared/logic/theme';

/** Čísla a „=“ příkladu. */
export const EQUATION_STYLE = {
  color: TEXT,
  fontWeight: 'bold',
} as const;

/**
 * Okénko na místě znaménka: prázdné bílé s šedým okrajem, po správné
 * odpovědi zelené s bílým znaménkem, po chybě chvíli šedé znaménko.
 */
export const SIGN_BOX_STYLE = {
  fill: WHITE,
  border: '#AEAEB2',
  /** Tloušťka okraje v CSS px. */
  borderWidth: 4,
  correctFill: SUCCESS_GREEN,
  correctSign: WHITE,
  wrongSign: '#8E8E93',
  fontWeight: 'bold',
} as const;

/** Tlačítka + a − jako tlačítka s čísly v Počítání. */
export const SIGN_BUTTON_STYLE = {
  fill: '#E5F0FF',
  border: '#B8D6FF',
  borderWidth: 2,
  symbolColor: BLUE,
  fontWeight: 'bold',
} as const;

// ---------------------------------------------------------------------------
// Nastavení pro rodiče (#179) ve stejném světlém vzhledu jako v Počítání (#53).
// ---------------------------------------------------------------------------

/** Pozadí panelu: stejné jako stránka, neprůhledné, aby ťuknutí nepropadla do hry. */
export const SETTINGS_PANEL_BACKGROUND = PAGE_BACKGROUND;

/** Nevybraná volba jako tlačítka + a −, vybraná plná modrá s bílým obsahem. */
export const SETTINGS_OPTION_STYLE = {
  unselected: { fill: SIGN_BUTTON_STYLE.fill, border: SIGN_BUTTON_STYLE.border, content: BLUE },
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
