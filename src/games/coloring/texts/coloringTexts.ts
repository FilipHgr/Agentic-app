/**
 * Texty hry Omalovánky (#88) v souborech podle kódu jazyka (`cs.ts`). Hra
 * nemá na obrazovce žádné texty (AC7), jen název v menu a repliky pandy
 * Rudyho, které zazní nahrávkou (#175). Typ hlídá, že žádnému jazyku
 * nechybí klíč, takže chybějící překlad zastaví už `npm run build`.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { ColoringRudyLine } from '../logic/rudyLines';
import cs from './cs';
import en from './en';

export interface ColoringTexts {
  /** Název hry pro menu. */
  readonly title: string;
  /**
   * Repliky pandy Rudyho (#175); zazní jen nahrávky
   * `public/voice/<jazyk>/coloring/rudy-<id>.mp3`, na obrazovce text není.
   */
  readonly rudyLines: Readonly<Record<ColoringRudyLine, string>>;
}

const COLORING_TEXTS: Record<Language, ColoringTexts> = { cs, en };

/** Texty Omalovánek v jazyce, bez zadání v aktuálním jazyce. */
export function coloringTexts(language: Language = currentLanguage()): ColoringTexts {
  return COLORING_TEXTS[language];
}
