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

/**
 * Nápověda párováním (#180): spárovaná tečka se po spojení ztlumí, tečka
 * bez dvojice svítí a kolem ní pulzuje záře v barvě karty. Spojení dvojice
 * se rozsvítí jako šedá čára mezi tečkami a pak zůstane jemně vidět.
 */
export const HINT_STYLE = {
  pairedAlpha: 0.35,
  linkColor: '#6E6E73',
  /** Tloušťka čáry spojení v CSS px. */
  linkWidth: 5,
  linkAlpha: 0.9,
  /** Čára chvíli svítí a pak zjemní na `linkRestAlpha`. */
  linkHoldMs: 300,
  linkFadeMs: 500,
  linkRestAlpha: 0.25,
  /** Tečka dvojice se při spojení krátce zvětší. */
  popScale: 1.35,
  popMs: 120,
  glowAlpha: 0.4,
  /** Záře pulzuje mezi základní velikostí a tímto zvětšením. */
  glowPulseScale: 1.08,
  glowPulseMs: 600,
  /** Tečky pod samotným číslem naskočí ze zmenšení. */
  dotsAppearMs: 200,
} as const;

/**
 * Symbol otázky nad kartami (#182): hromádka fialových teček (jiná barva
 * než tečky karet, aby je dítě nepočítalo s kartami) na šedé podložce.
 * Fialová má proti pozadí stránky kontrast aspoň 3 : 1. Při změně otázky
 * symbol krátce naskočí, po ťuknutí se zhoupne.
 */
export const QUESTION_STYLE = {
  dot: '#7C3AED',
  ground: '#C7C7CC',
  popFrom: 0.6,
  popMs: 260,
  /** Po ťuknutí se symbol zhoupne do stran (stupně, ms jednoho kmitu). */
  swayDegrees: 8,
  swayMs: 110,
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
