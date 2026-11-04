/**
 * Scénář průvodce nastavením (#50): jediný zdroj vět, které průvodce ukáže
 * na obrazovce a které skript `tools/voice/` nechá namluvit. Mluvený text je
 * oba řádky věty za sebou, proto jsou číslice a značky vypsané slovy.
 */

import type { SettingsRowKind } from './settingsLayout';
import type { GuideStep } from './setupGuide';

export type GuideLineId = SettingsRowKind | 'summary';

export interface GuideLine {
  readonly id: GuideLineId;
  readonly step: GuideStep;
  /** Řádek 1 a řádek 2 na obrazovce; v nahrávce zazní oba za sebou. */
  readonly lines: readonly [string, string];
}

/** Věty podle scénáře v #50 (po zrušení otázky na třídu), ve stejném pořadí. */
const LINES: Record<GuideLineId, Omit<GuideLine, 'id'>> = {
  maxNumber: {
    step: 1,
    lines: [
      'Největší číslo, které se v příkladech objeví.',
      'Školka do pěti, první třída do deseti, pak do dvaceti.',
    ],
  },
  operations: {
    step: 2,
    lines: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Začněte sčítáním. Obojí, až dítě zvládne odčítat.',
    ],
  },
  answerInput: {
    step: 3,
    lines: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Tužku zvolte, až dítě umí psát všechny číslice.',
    ],
  },
  summary: {
    step: 4,
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
