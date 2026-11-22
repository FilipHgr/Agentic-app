/**
 * Texty přehledu pro rodiče (#192) řádek po řádku: stránka 7 dní
 * (nadpis, zkratky dnů, vysvětlivky a součty) a stránka Chyby (oddíly
 * s nadpisem a řádky). Co stránka Chyby u hry ukáže, říká popis přehledu
 * hry z `meta.ts`: Počítání podíl napoprvé pro sčítání a odčítání, časté
 * chyby a nápovědu, Znaménka jen časté chyby. Čistý TypeScript.
 */

import { MAX_FREQUENT_MISTAKES } from '../../shared/logic/mistakeActivity';
import type { MistakeOverview, OperationShare } from '../../shared/logic/mistakeActivity';
import { formatOverviewProblem } from '../../shared/logic/overviewProblems';
import type { GameOverviewSpec } from '../../shared/logic/overviewProblems';
import type { WeekOverview } from '../../shared/logic/weekActivity';
import type { Language } from '../../shared/texts/languages';
import type { OverviewTexts } from '../texts/menuTextsTypes';

/** Řádek součtu: „Za týden vyřešeno: 23“. Dvojtečka je znak, ne text jazyka. */
export function overviewTotalLine(label: string, count: number): string {
  return `${label}: ${count}`;
}

/** Procenta podle zvyklostí jazyka: česky „75 %“, anglicky „75%“. */
function percentText(percent: number, language: Language): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / 100,
  );
}

/** Řádek podílu: „Sčítání: 75 % (3/4)“. Dvojtečka, lomítko a závorky jsou znaky. */
export function operationShareLine(
  label: string,
  share: OperationShare,
  language: Language,
): string {
  return `${label}: ${percentText(share.percent, language)} (${share.firstTry}/${share.solved})`;
}

/** Řádek časté chyby podle vzoru z textů jazyka, například „8 + 5 (4×)“ nebo „7 ☐ 5 (2×)“. */
export function frequentMistakeLine(template: string, problem: string, mistakes: number): string {
  return template
    .replace('{problem}', formatOverviewProblem(problem))
    .replace('{count}', String(mistakes));
}

/** Texty stránky 7 dní. */
export interface WeekLines {
  readonly title: string;
  /** Zkratky dnů pod sloupečky od nejstaršího dne po dnešek. */
  readonly days: readonly string[];
  /** Vysvětlivka světlejší (po chybě) a tmavší (napoprvé) části sloupečku. */
  readonly legend: readonly [string, string];
  readonly totals: readonly [string, string];
  /** Nápis místo sloupečků, když za 7 dní nic není; jinak `null`. */
  readonly empty: string | null;
}

/** Vysvětlivka světlejší části sloupečku: u hry s nápovědou „Po chybě nebo s nápovědou“. */
export function afterMistakeLegend(spec: GameOverviewSpec, texts: OverviewTexts): string {
  return spec.hints ? texts.legendNotFirstTry : texts.legendAfterMistake;
}

export function weekLines(
  week: WeekOverview,
  spec: GameOverviewSpec,
  texts: OverviewTexts,
): WeekLines {
  return {
    title: texts.weekTitle,
    days: week.days.map((day) => texts.dayNames[day.weekday]),
    legend: [afterMistakeLegend(spec, texts), texts.legendFirstTry],
    totals: [
      overviewTotalLine(texts.totalSolved, week.totalSolved),
      overviewTotalLine(texts.totalFirstTry, week.totalFirstTry),
    ],
    empty: week.isEmpty ? texts.empty : null,
  };
}

/** Řádek stránky Chyby; nadpis oddílu je tučně. */
export interface OverviewLine {
  readonly text: string;
  readonly heading: boolean;
}

/** Oddíl stránky Chyby: řádky pod sebou, mezi oddíly je mezera. */
export type OverviewSection = readonly OverviewLine[];

/** Kolik nejvýš řádků má každý oddíl stránky Chyby hry s popisem `spec` (pro rozložení). */
export function mistakeSectionSizes(spec: GameOverviewSpec): number[] {
  const sizes: number[] = [];
  if (spec.operations.length > 0) {
    sizes.push(1 + spec.operations.length);
  }
  sizes.push(1 + MAX_FREQUENT_MISTAKES);
  if (spec.hints) {
    sizes.push(1);
  }
  return sizes;
}

const heading = (text: string): OverviewLine => ({ text, heading: true });
const row = (text: string): OverviewLine => ({ text, heading: false });

/**
 * Stránka Chyby: podíl napoprvé (jen hra s druhy příkladů; bez hraní
 * „Zatím žádné příklady“), časté chyby (bez nich „Bez častých chyb“)
 * a nápověda za týden (jen hra s nápovědou).
 */
export function mistakeSections(
  mistakes: MistakeOverview,
  spec: GameOverviewSpec,
  texts: OverviewTexts,
  language: Language,
): OverviewSection[] {
  const sections: OverviewSection[] = [];
  if (spec.operations.length > 0) {
    const shares = mistakes.operations.map((share) =>
      row(
        operationShareLine(
          share.operation === 'plus' ? texts.addition : texts.subtraction,
          share,
          language,
        ),
      ),
    );
    sections.push([
      heading(texts.firstTryHeading),
      ...(shares.length > 0 ? shares : [row(texts.empty)]),
    ]);
  }
  const frequent = mistakes.frequent.map((mistake) =>
    row(frequentMistakeLine(texts.frequentItem, mistake.problem, mistake.mistakes)),
  );
  sections.push([
    heading(texts.frequentHeading),
    ...(frequent.length > 0 ? frequent : [row(texts.noFrequent)]),
  ]);
  if (spec.hints) {
    sections.push([row(overviewTotalLine(texts.hintsUsed, mistakes.hintsUsed))]);
  }
  return sections;
}
