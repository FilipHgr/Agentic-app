/**
 * Scénář průvodce nastavením (#50): jediný zdroj vět, které průvodce ukáže
 * na obrazovce a které skript `tools/voice/` nechá namluvit. Mluvený text je
 * oba řádky věty za sebou, proto jsou číslice a značky vypsané slovy.
 */

import type { SettingsRowKind } from './settingsLayout';
import type { Grade, GuideStep } from './setupGuide';

export type GuideLineId = 'question' | 'summary' | `${SettingsRowKind}.${Grade}`;

export interface GuideLine {
  readonly id: GuideLineId;
  readonly step: GuideStep;
  /** Řádek 1 a řádek 2 na obrazovce; v nahrávce zazní oba za sebou. */
  readonly lines: readonly [string, string];
}

const MAX_NUMBER_EXPLANATION = 'Největší číslo, které se v příkladech objeví.';
const OPERATIONS_EXPLANATION = 'Sčítání, odčítání, nebo obojí zamíchané.';
const ANSWER_INPUT_EXPLANATION = 'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.';

/** Věty podle tabulky v #50, ve stejném pořadí. */
const LINES: Record<GuideLineId, Omit<GuideLine, 'id'>> = {
  question: {
    step: 1,
    lines: ['Do které třídy dítě chodí?', 'Podle odpovědi hru předvyplníme. Odpověď se neukládá.'],
  },
  'maxNumber.preschool': {
    step: 2,
    lines: [MAX_NUMBER_EXPLANATION, 'Doporučujeme do pěti. Dítě to spočítá na prstech ruky.'],
  },
  'maxNumber.firstGrade': {
    step: 2,
    lines: [MAX_NUMBER_EXPLANATION, 'Doporučujeme do deseti, ve druhém pololetí do dvaceti.'],
  },
  'maxNumber.secondGradeOrHigher': {
    step: 2,
    lines: [MAX_NUMBER_EXPLANATION, 'Doporučujeme do dvaceti. Procvičí přechod přes desítku.'],
  },
  'operations.preschool': {
    step: 3,
    lines: [OPERATIONS_EXPLANATION, 'Doporučujeme sčítání. Pro malé děti je nejsnazší.'],
  },
  'operations.firstGrade': {
    step: 3,
    lines: [OPERATIONS_EXPLANATION, 'Doporučujeme obojí. V první třídě se učí současně.'],
  },
  'operations.secondGradeOrHigher': {
    step: 3,
    lines: [OPERATIONS_EXPLANATION, 'Doporučujeme obojí. Dítě musí sledovat znaménko.'],
  },
  'answerInput.preschool': {
    step: 4,
    lines: [ANSWER_INPUT_EXPLANATION, 'Doporučujeme číselník. Psát číslice se dítě teprve učí.'],
  },
  'answerInput.firstGrade': {
    step: 4,
    lines: [ANSWER_INPUT_EXPLANATION, 'Doporučujeme číselník. Tužku, až zvládne psát číslice.'],
  },
  'answerInput.secondGradeOrHigher': {
    step: 4,
    lines: [ANSWER_INPUT_EXPLANATION, 'Doporučujeme tužku. Dítě si procvičí i psaní číslic.'],
  },
  summary: {
    step: 5,
    lines: [
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ],
  },
};

export const GUIDE_SCRIPT: readonly GuideLine[] = (Object.keys(LINES) as GuideLineId[]).map(
  (id) => ({ id, ...LINES[id] }),
);

/** Dva řádky věty na obrazovce. */
export function scriptLines(id: GuideLineId): readonly [string, string] {
  return LINES[id].lines;
}

/** Co zazní v nahrávce: oba řádky za sebou. */
export function spokenText(line: GuideLine): string {
  return `${line.lines[0]} ${line.lines[1]}`;
}

/** Věty pro skript, který vytváří nahrávky. */
export function voiceSentences(): { id: GuideLineId; text: string }[] {
  return GUIDE_SCRIPT.map((line) => ({ id: line.id, text: spokenText(line) }));
}
