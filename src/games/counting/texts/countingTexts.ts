/**
 * Texty hry Počítání (#65) v souborech podle kódu jazyka (`cs.ts`). Typ
 * hlídá, že žádnému jazyku nechybí klíč, takže chybějící překlad zastaví
 * už `npm run build`. Symboly (číslice, +, −, „123“, ✓, otazník, „1 / 4“)
 * nejsou texty jazyka a zůstávají v kódu.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import type { GuideLineId } from '../logic/guideScript';
import type { CountingRudyLine } from '../logic/rudyLines';
import type { SettingsRowKind } from '../logic/settingsLayout';
import cs from './cs';
import en from './en';

export interface CountingTexts {
  /** Název hry pro menu (AC2 v #65), zatím se nikde nezobrazuje. */
  readonly title: string;
  /** Popisky řad nastavení pro rodiče (#47). */
  readonly rowLabels: Readonly<Record<SettingsRowKind, string>>;
  /** Tlačítka průvodce nastavením (#49). */
  readonly guideButtons: {
    readonly back: string;
    readonly next: string;
    readonly startPlaying: string;
  };
  /**
   * Věty průvodce (#50): dva řádky na obrazovce, v nahrávce zazní oba za
   * sebou. Proto jsou číslice a značky vypsané slovy.
   */
  readonly guideLines: Readonly<Record<GuideLineId, readonly [string, string]>>;
  /**
   * Repliky pandy Rudyho (#171): pozdravy po otevření hry a oslavy po 10
   * hvězdičkách, varianty se střídají (#176). Text se nezobrazuje, zazní jen nahrávka
   * `public/voice/<jazyk>/counting/rudy-<id>.mp3`.
   */
  readonly rudyLines: Readonly<Record<CountingRudyLine, string>>;
  /** Přehled pro rodiče za kolečkem (#183). */
  readonly overview: OverviewTexts;
}

/** Texty přehledu pro rodiče (#183). */
export interface OverviewTexts {
  /** Tlačítko v nastavení, které přehled otevře. */
  readonly button: string;
  readonly title: string;
  /**
   * Vysvětlivky obou odstínů sloupečků: světlejší část jsou příklady
   * vyřešené po chybě nebo s nápovědou, tmavší napoprvé.
   */
  readonly legendNotFirstTry: string;
  readonly legendFirstTry: string;
  /** Popisky součtů pod grafem; za ně přijde dvojtečka a číslo. */
  readonly totalSolved: string;
  readonly totalFirstTry: string;
  /** Nápis bez dat (AC4). */
  readonly empty: string;
  /** Návrat z přehledu do nastavení. */
  readonly back: string;
  /** Zkratky dnů od pondělí do neděle. */
  readonly dayNames: readonly [string, string, string, string, string, string, string];
}

const COUNTING_TEXTS: Record<Language, CountingTexts> = { cs, en };

/** Texty Počítání v jazyce, bez zadání v aktuálním jazyce. */
export function countingTexts(language: Language = currentLanguage()): CountingTexts {
  return COUNTING_TEXTS[language];
}
