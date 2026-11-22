/**
 * Texty hry Porovnávání (#178) v souborech podle kódu jazyka (`cs.ts`).
 * Na herní obrazovce texty nejsou, jen název v menu a popisky řad
 * nastavení pro rodiče (#179). Typ hlídá, že žádnému jazyku nechybí klíč,
 * takže chybějící překlad zastaví už `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import cs from './cs';
import en from './en';

export interface CompareTexts {
  /** Název hry pro menu. */
  readonly title: string;
  /** Popisky řad nastavení pro rodiče (#179). */
  readonly rowLabels: {
    readonly maxNumber: string;
    readonly show: string;
  };
}

const COMPARE_TEXTS: Record<Language, CompareTexts> = { cs, en };

/** Texty Porovnávání v jazyce, bez zadání v aktuálním jazyce. */
export function compareTexts(language: Language = currentLanguage()): CompareTexts {
  return COMPARE_TEXTS[language];
}
