/**
 * Texty hry Porovnávání (#178) v souborech podle kódu jazyka (`cs.ts`).
 * Hra nemá na obrazovce žádné texty, jen název v menu. Typ hlídá, že
 * žádnému jazyku nechybí klíč, takže chybějící překlad zastaví už
 * `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import cs from './cs';
import en from './en';

export interface CompareTexts {
  /** Název hry pro menu. */
  readonly title: string;
}

const COMPARE_TEXTS: Record<Language, CompareTexts> = { cs, en };

/** Texty Porovnávání v jazyce, bez zadání v aktuálním jazyce. */
export function compareTexts(language: Language = currentLanguage()): CompareTexts {
  return COMPARE_TEXTS[language];
}
