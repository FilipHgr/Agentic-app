/**
 * Scénář průvodce nastavením (#50): které věty průvodce ukáže na obrazovce
 * a které skript `tools/voice/` nechá namluvit. Samotné věty jsou v textech
 * Počítání (`texts/`, #65), obrazovka i nahrávka je berou odtamtud. Mluvený
 * text je oba řádky věty za sebou.
 */

import { countingTexts } from '../texts/countingTexts';
import type { CountingTexts } from '../texts/countingTexts';
import type { SettingsRowKind } from './settingsLayout';
import type { GuideStep } from './setupGuide';

export type GuideLineId = SettingsRowKind | 'summary';

export interface GuideLine {
  readonly id: GuideLineId;
  readonly step: GuideStep;
  /** Řádek 1 a řádek 2 na obrazovce; v nahrávce zazní oba za sebou. */
  readonly lines: readonly [string, string];
}

/** Krok průvodce každé věty, ve stejném pořadí jako scénář v #50 (po zrušení otázky na třídu). */
const STEP_OF_LINE: Record<GuideLineId, GuideStep> = {
  maxNumber: 1,
  operations: 2,
  answerInput: 3,
  summary: 4,
};

export const GUIDE_SCRIPT: readonly GuideLine[] = (Object.keys(STEP_OF_LINE) as GuideLineId[]).map(
  (id) => ({ id, step: STEP_OF_LINE[id], lines: scriptLines(id) }),
);

/** Dva řádky věty na obrazovce. */
export function scriptLines(id: GuideLineId): readonly [string, string] {
  return countingTexts().guideLines[id];
}

/** Co zazní v nahrávce: oba řádky za sebou. */
export function spokenText(line: GuideLine): string {
  return `${line.lines[0]} ${line.lines[1]}`;
}

/**
 * Věty pro skript, který vytváří nahrávky: z textů zadaného jazyka (#66),
 * bez zadání z textů aktuálního jazyka.
 */
export function voiceSentences(
  texts: CountingTexts = countingTexts(),
): { id: GuideLineId; text: string }[] {
  return GUIDE_SCRIPT.map((line) => ({
    id: line.id,
    text: spokenText({ ...line, lines: texts.guideLines[line.id] }),
  }));
}
