/**
 * Texty hry Omalovánky (#88) v souborech podle kódu jazyka (`cs.ts`). Hra
 * nemá žádné texty kromě názvu v menu (AC7). Typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import cs from './cs';
import en from './en';

export interface ColoringTexts {
  /** Název hry pro menu. */
  readonly title: string;
}

const COLORING_TEXTS: Record<Language, ColoringTexts> = { cs, en };

/** Texty Omalovánek v jazyce, bez zadání v aktuálním jazyce. */
export function coloringTexts(language: Language = currentLanguage()): ColoringTexts {
  return COLORING_TEXTS[language];
}
