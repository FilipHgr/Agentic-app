/**
 * Písmo příkladu na telefonu v CSS px, jak ho hráč viděl před změnou
 * rozložení v #63 (příklad bez nikoho vedle). Testy „písmo aspoň jako dřív“
 * porovnávají s těmito hodnotami, ne s tím, co spočítá nový kód.
 *
 * Na šířku (#54) závisí písmo na okně, rozsahu, ovládání a skupinkách teček
 * nápovědy (nápověda rozložení posouvá). `withoutHint` je písmo bez
 * nápovědy, `withHint` s nápovědou. Kde se písmo s nápovědou lišilo podle
 * skupinek, platí `withHint` pro všechny nápovědy kromě vyjmenovaných
 * v `except`: písmo → skupinky teček oddělené mezerou („7+3“ je 7 a 3
 * tečky, „10“ jedna skupinka 10 teček). Počet hvězdiček písmo neměnil.
 *
 * Na výšku (#56) je místo pro nápovědu vyhrazené, písmo záviselo jen na
 * okně a rozsahu (stejné pro číselník i psaní a všechny druhy příkladů).
 *
 * Hodnoty nahradily v #81 dřívější seznamy po jednotlivých nápovědách
 * (`phoneFontBefore63.ts`, vypočtené z commitu 4dc5115 na sprint-3) beze
 * změny obsahu: pro každou nápovědu vychází stejné písmo.
 */

import type { MaxNumber } from '../../../src/games/counting/logic/settings';

export type InputMode = 'keypad' | 'writing';

interface InputFonts {
  readonly withoutHint: number;
  readonly withHint: number;
  readonly except?: Readonly<Record<number, string>>;
}

type LandscapeWindowFonts = Readonly<Record<MaxNumber, Readonly<Record<InputMode, InputFonts>>>>;
type PortraitFonts = Readonly<Record<MaxNumber, number>>;

/**
 * Všechny různé skupinky teček nápovědy v rozsahu: jedna skupinka 1 až
 * rozsah (odčítání, sčítání s nulou) a dvě skupinky a + b ≤ rozsah.
 */
export function hintGroupsInRange(maxNumber: MaxNumber): number[][] {
  const groups: number[][] = [];
  for (let first = 1; first <= maxNumber; first += 1) {
    groups.push([first]);
  }
  for (let first = 1; first <= maxNumber; first += 1) {
    for (let second = 1; first + second <= maxNumber; second += 1) {
      groups.push([first, second]);
    }
  }
  return groups;
}

/** Skupinky teček zapsané jako v `except`: „7+3“, „10“. */
export function groupsName(groups: readonly number[]): string {
  return groups.join('+');
}

export const LANDSCAPE_FONT_BEFORE: Readonly<Record<string, LandscapeWindowFonts>> = {
  '744×296 nejmenší telefon': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 56, withHint: 48 },
    },
    10: {
      keypad: {
        withoutHint: 64,
        withHint: 56,
        except: {
          48: '1+5 1+6 1+7 1+8 1+9 2+4 3+3 4+2 5+1 6+1 7+1 8+1 9+1',
          40: '2+5 2+6 2+7 2+8 3+4 4+3 5+2 6+2 7+2 8+2',
          32: '3+5 3+6 3+7 4+4 4+5 4+6 5+3 5+4 6+3 6+4 7+3',
        },
      },
      writing: { withoutHint: 56, withHint: 56 },
    },
    20: {
      keypad: { withoutHint: 36, withHint: 36 },
      writing: {
        withoutHint: 56,
        withHint: 56,
        except: {
          64: '16 17 18 19 20 1+16 1+17 1+18 1+19 2+16 2+17 2+18 3+16 3+17 4+16 16+1 16+2 16+3 16+4 17+1 17+2 17+3 18+1 18+2 19+1',
        },
      },
    },
  },
  '800×300 Samsung s Chromem': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 56, withHint: 48 },
    },
    10: {
      keypad: {
        withoutHint: 64,
        withHint: 56,
        except: {
          72: '6 7 8 9 10 5+5',
          48: '2+5 2+6 2+7 2+8 3+4 4+3 5+2 6+2 7+2 8+2',
          44: '3+5 3+6 3+7 4+4 5+3 6+3 7+3',
          36: '4+6 6+4',
          32: '4+5 5+4',
        },
      },
      writing: { withoutHint: 56, withHint: 48 },
    },
    20: {
      keypad: { withoutHint: 48, withHint: 48 },
      writing: {
        withoutHint: 56,
        withHint: 48,
        except: {
          64: '16 17 18 19 20 1+16 1+17 1+18 1+19 2+16 2+17 2+18 3+16 3+17 4+16 16+1 16+2 16+3 16+4 17+1 17+2 17+3 18+1 18+2 19+1',
        },
      },
    },
  },
  '844×340 iPhone se Safari': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 56, withHint: 48 },
    },
    10: {
      keypad: {
        withoutHint: 64,
        withHint: 44,
        except: {
          72: '4+5',
          64: '6 7 8 9 10 5+4 5+5',
          48: '1+6 1+7 1+8 1+9 6+1 7+1 8+1 9+1',
          36: '3+6 3+7 4+6 6+3 6+4 7+3',
          32: '3+5 4+4 5+3',
        },
      },
      writing: { withoutHint: 56, withHint: 48 },
    },
    20: {
      keypad: { withoutHint: 36, withHint: 36 },
      writing: {
        withoutHint: 56,
        withHint: 48,
        except: {
          72: '16 17 18 19 20 1+16 1+17 1+18 1+19 2+16 2+17 2+18 16+1 16+2 17+1 17+2 18+1 18+2 19+1',
          64: '11 12 13 14 15 1+11 1+12 1+13 1+14 1+15 2+11 2+12 2+13 2+14 2+15 3+11 3+12 3+13 3+14 3+15 3+16 3+17 4+11 4+12 4+13 4+14 4+15 4+16 11+1 11+2 11+3 11+4 12+1 12+2 12+3 12+4 13+1 13+2 13+3 13+4 14+1 14+2 14+3 14+4 15+1 15+2 15+3 15+4 16+3 16+4 17+3',
          56: '5+11 5+12 5+13 5+14 5+15 6+11 6+12 6+13 6+14 7+11 7+12 7+13 8+11 8+12 9+11 11+5 11+6 11+7 11+8 11+9 12+5 12+6 12+7 12+8 13+5 13+6 13+7 14+5 14+6 15+5',
        },
      },
    },
  },
  '932×430 iPhone Pro Max': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 72, withHint: 72 },
    },
    10: {
      keypad: {
        withoutHint: 72,
        withHint: 72,
        except: {
          64: '1+6 1+7 1+8 1+9 2+6 2+7 2+8 6+1 6+2 7+1 7+2 8+1 8+2 9+1',
          56: '3+6 3+7 6+3 7+3',
          48: '4+6 6+4',
        },
      },
      writing: { withoutHint: 72, withHint: 72 },
    },
    20: {
      keypad: { withoutHint: 36, withHint: 36 },
      writing: { withoutHint: 72, withHint: 72 },
    },
  },
  '932×499 těsně pod hranicí': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 72, withHint: 72 },
    },
    10: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 72, withHint: 72 },
    },
    20: {
      keypad: { withoutHint: 48, withHint: 48 },
      writing: { withoutHint: 72, withHint: 72 },
    },
  },
  '932×499 těsně pod hranicí s výřezem': {
    5: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 72, withHint: 72 },
    },
    10: {
      keypad: { withoutHint: 72, withHint: 72 },
      writing: { withoutHint: 72, withHint: 72 },
    },
    20: {
      keypad: { withoutHint: 36, withHint: 36 },
      writing: { withoutHint: 72, withHint: 72 },
    },
  },
};

export const PORTRAIT_FONT_BEFORE: Readonly<Record<string, PortraitFonts>> = {
  '390×844 iPhone 13–15 (výřez 47, lišta 34)': { 5: 64, 10: 56, 20: 48 },
  '390×664 iPhone v Safari s lištou': { 5: 64, 10: 56, 20: 48 },
  '360×780 Samsung s Chromem': { 5: 64, 10: 48, 20: 44 },
  '375×667 iPhone SE': { 5: 64, 10: 48, 20: 48 },
  '430×932 iPhone Pro Max (výřez 59, lišta 34)': { 5: 72, 10: 56, 20: 56 },
  '360×620 nejmenší telefon na výšku': { 5: 64, 10: 48, 20: 44 },
  '499×932 těsně pod hranicí šířky': { 5: 72, 10: 72, 20: 64 },
  '375×1180 úzký iPad (Split View)': { 5: 64, 10: 48, 20: 48 },
};

/** Písmo před #63 na šířku pro okno, rozsah a ovládání; `undefined`, když okno chybí. */
export function landscapeFontsBefore(
  windowName: string,
  maxNumber: MaxNumber,
  mode: InputMode,
): InputFonts | undefined {
  return LANDSCAPE_FONT_BEFORE[windowName]?.[maxNumber][mode];
}

/** Písmo před #63 s nápovědou `groups`: písmo z `except`, kde je nápověda vyjmenovaná, jinak `withHint`. */
export function fontWithHintBefore(fonts: InputFonts, groups: readonly number[]): number {
  const name = groupsName(groups);
  for (const [font, listed] of Object.entries(fonts.except ?? {})) {
    if (listed.split(' ').includes(name)) {
      return Number(font);
    }
  }
  return fonts.withHint;
}
