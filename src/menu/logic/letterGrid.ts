/**
 * Mřížka písmen pro přezdívku profilu (#72 AC3): dvě vrstvy, protože celá
 * česká abeceda se na nejmenší telefony nevejde. Základní vrstva má A–Z,
 * vrstva diakritiky Á–Ž. Obě mají přepínač vrstvy a smazání ⌫ na stejném
 * místě. Písmena jsou symboly v kódu, ne texty jazyka.
 * Čistý TypeScript bez Phaseru.
 */

/** Základní vrstva: 26 písmen A–Z abecedně. */
export const BASE_LETTERS: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Vrstva diakritiky: česká písmena s háčkem, čárkou a kroužkem. */
export const ACCENT_LETTERS: readonly string[] = [
  'Á',
  'Č',
  'Ď',
  'É',
  'Ě',
  'Í',
  'Ň',
  'Ó',
  'Ř',
  'Š',
  'Ť',
  'Ú',
  'Ů',
  'Ý',
  'Ž',
];

/** Přezdívka má nejvýš 12 písmen. */
export const MAX_NICKNAME_LENGTH = 12;

/** Symbol přepínače na základní vrstvě (přepne na diakritiku). */
export const SWITCH_TO_ACCENTS_SYMBOL = 'ÁČ';
/** Symbol přepínače na vrstvě diakritiky (přepne zpět). */
export const SWITCH_TO_BASE_SYMBOL = 'AB';

export type LetterLayer = 'base' | 'accents';

export type LetterKey =
  | { readonly kind: 'letter'; readonly letter: string }
  | { readonly kind: 'switch' }
  | { readonly kind: 'backspace' };

/** Písmena jedné vrstvy. */
export function lettersOf(layer: LetterLayer): readonly string[] {
  return layer === 'base' ? BASE_LETTERS : ACCENT_LETTERS;
}

/** Klávesy vrstvy v pořadí mřížky: písmena, přepínač a nakonec ⌫. */
export function letterKeys(layer: LetterLayer): LetterKey[] {
  return [
    ...lettersOf(layer).map((letter): LetterKey => ({ kind: 'letter', letter })),
    { kind: 'switch' },
    { kind: 'backspace' },
  ];
}

/** Na které vrstvě písmeno je; `null`, když v mřížce není. */
export function layerOfLetter(letter: string): LetterLayer | null {
  if (BASE_LETTERS.includes(letter)) {
    return 'base';
  }
  return ACCENT_LETTERS.includes(letter) ? 'accents' : null;
}

/**
 * Písmeno mřížky z klávesy fyzické klávesnice (`KeyboardEvent.key`):
 * malé písmeno dá velké, cokoli mimo mřížku `null`.
 */
export function letterFromKey(key: string): string | null {
  if ([...key].length !== 1) {
    return null;
  }
  const upper = key.toLocaleUpperCase('cs');
  return layerOfLetter(upper) === null ? null : upper;
}
