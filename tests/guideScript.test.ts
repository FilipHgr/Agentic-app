import { describe, expect, it } from 'vitest';

import { GUIDE_SCRIPT, spokenText, voiceSentences } from '../src/logic/guideScript';
import type { GuideLine } from '../src/logic/guideScript';
import {
  GRADE_OPTIONS,
  GUIDE_TEXTS,
  back,
  chooseGrade,
  guideMessage,
  next,
  skip,
  startGuide,
  tickGuide,
} from '../src/logic/setupGuide';
import type { Grade, GuideState } from '../src/logic/setupGuide';
import type { SettingsRowKind } from '../src/logic/settingsLayout';

/**
 * Testy k #50 AC1: věty průvodce podle scénáře pro namluvení. Scénář je
 * jediný zdroj vět pro hru i pro skript na nahrávky. Rozložení z #49 AC5
 * je v `setupGuideLayout.test.ts`, chování průvodce v `setupGuide.test.ts`.
 */

const T0 = 10_000;
const HIGHLIGHT_MS = 300;
const MAX_LINE_CHARACTERS = 56;
const ROWS: readonly SettingsRowKind[] = ['maxNumber', 'operations', 'answerInput'];

/** Scénář ze zadání #50: id, krok a dva řádky. */
const EXPECTED_SCRIPT: readonly { id: string; step: number; lines: [string, string] }[] = [
  {
    id: 'question',
    step: 1,
    lines: ['Do které třídy dítě chodí?', 'Podle odpovědi hru předvyplníme. Odpověď se neukládá.'],
  },
  {
    id: 'maxNumber.preschool',
    step: 2,
    lines: [
      'Největší číslo, které se v příkladech objeví.',
      'Doporučujeme do pěti. Dítě to spočítá na prstech ruky.',
    ],
  },
  {
    id: 'maxNumber.firstGrade',
    step: 2,
    lines: [
      'Největší číslo, které se v příkladech objeví.',
      'Doporučujeme do deseti, ve druhém pololetí do dvaceti.',
    ],
  },
  {
    id: 'maxNumber.secondGradeOrHigher',
    step: 2,
    lines: [
      'Největší číslo, které se v příkladech objeví.',
      'Doporučujeme do dvaceti. Procvičí přechod přes desítku.',
    ],
  },
  {
    id: 'operations.preschool',
    step: 3,
    lines: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Doporučujeme sčítání. Pro malé děti je nejsnazší.',
    ],
  },
  {
    id: 'operations.firstGrade',
    step: 3,
    lines: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Doporučujeme obojí. V první třídě se učí současně.',
    ],
  },
  {
    id: 'operations.secondGradeOrHigher',
    step: 3,
    lines: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Doporučujeme obojí. Dítě musí sledovat znaménko.',
    ],
  },
  {
    id: 'answerInput.preschool',
    step: 4,
    lines: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Doporučujeme číselník. Psát číslice se dítě teprve učí.',
    ],
  },
  {
    id: 'answerInput.firstGrade',
    step: 4,
    lines: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Doporučujeme číselník. Tužku, až zvládne psát číslice.',
    ],
  },
  {
    id: 'answerInput.secondGradeOrHigher',
    step: 4,
    lines: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Doporučujeme tužku. Dítě si procvičí i psaní číslic.',
    ],
  },
  {
    id: 'summary',
    step: 5,
    lines: [
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ],
  },
];

function scriptLine(id: string): GuideLine {
  const line = GUIDE_SCRIPT.find((candidate) => candidate.id === id);
  if (line === undefined) {
    throw new Error(`věta ${id} ve scénáři chybí`);
  }
  return line;
}

function answer(state: GuideState, grade: Grade): GuideState {
  return tickGuide(chooseGrade(state, grade, T0), T0 + HIGHLIGHT_MS);
}

describe('scénář průvodce (#50 AC1)', () => {
  it('scénář má přesně 11 vět ze zadání, každou se dvěma řádky', () => {
    expect(GUIDE_SCRIPT.map(({ id, step, lines }) => ({ id, step, lines: [...lines] }))).toEqual(
      EXPECTED_SCRIPT,
    );
  });

  it('krok 1 a krok 5 mají jednu větu, kroky 2–4 jednu větu pro každou třídu', () => {
    const countOnStep = (step: number) => GUIDE_SCRIPT.filter((line) => line.step === step).length;
    expect([1, 2, 3, 4, 5].map(countOnStep)).toEqual([1, 3, 3, 3, 1]);
  });

  it('každá věta má jiné id, aby měla svou vlastní nahrávku', () => {
    const ids = GUIDE_SCRIPT.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('každý řádek má nejvýš 56 znaků a žádný není prázdný', () => {
    for (const { id, lines } of GUIDE_SCRIPT) {
      for (const line of lines) {
        expect(line.trim(), id).not.toBe('');
        expect([...line].length, line).toBeLessThanOrEqual(MAX_LINE_CHARACTERS);
      }
    }
  });

  it('věty neobsahují číslice ani značky + a −, vše je vypsané slovy pro namluvení', () => {
    for (const { lines } of GUIDE_SCRIPT) {
      for (const line of lines) {
        expect(line, line).not.toMatch(/[0-9+−-]/);
      }
    }
  });

  it('„123“ zazní ve větách jako „číselník“ a „+ −“ jako „obojí“', () => {
    expect(scriptLine('answerInput.preschool').lines.join(' ')).toContain('číselník');
    expect(scriptLine('operations.firstGrade').lines[1]).toContain('obojí');
  });
});

describe('mluvený text je stejný jako text na obrazovce (#50 AC1)', () => {
  it('v nahrávce zazní oba řádky věty za sebou', () => {
    for (const line of GUIDE_SCRIPT) {
      expect(spokenText(line)).toBe(`${line.lines[0]} ${line.lines[1]}`);
    }
  });

  it('skript na nahrávky dostane ze scénáře 11 vět s id a mluveným textem', () => {
    expect(voiceSentences()).toEqual(
      GUIDE_SCRIPT.map((line) => ({ id: line.id, text: spokenText(line) })),
    );
    expect(voiceSentences()).toHaveLength(11);
  });
});

describe('na obrazovce je přesně text ze scénáře (#50 AC1)', () => {
  it('na kroku 1 je nadpis a podnadpis z věty „question“', () => {
    expect([GUIDE_TEXTS.question, GUIDE_TEXTS.questionNote]).toEqual(scriptLine('question').lines);
  });

  for (const grade of GRADE_OPTIONS) {
    it(`po odpovědi „${GUIDE_TEXTS.grades[grade]}“ ukazují kroky 2–4 věty ${grade} ze scénáře`, () => {
      let guide = answer(startGuide(), grade);
      for (const row of ROWS) {
        expect(guideMessage(guide), `${row}.${grade}`).toEqual(scriptLine(`${row}.${grade}`).lines);
        guide = next(guide, T0);
      }
    });

    it(`po odpovědi „${GUIDE_TEXTS.grades[grade]}“ je na shrnutí věta „summary“`, () => {
      let guide = answer(startGuide(), grade);
      for (let tap = 0; tap < 3; tap += 1) {
        guide = next(guide, T0);
      }
      expect(guideMessage(guide)).toEqual(scriptLine('summary').lines);
    });
  }

  it('po „Přeskočit“ je na shrnutí stejná věta „summary“', () => {
    expect(guideMessage(skip(startGuide(), T0))).toEqual(scriptLine('summary').lines);
  });

  it('po změně odpovědi na kroku 1 ukazuje krok 2 větu nové třídy', () => {
    let guide = back(answer(startGuide(), 'preschool'));
    guide = tickGuide(chooseGrade(guide, 'firstGrade', T0 + 2000), T0 + 2000 + HIGHLIGHT_MS);
    expect(guideMessage(guide)).toEqual(scriptLine('maxNumber.firstGrade').lines);
  });

  it('každá věta ze scénáře se v průvodci někde ukáže', () => {
    const shown = new Set<string>([JSON.stringify(scriptLine('question').lines)]);
    for (const grade of GRADE_OPTIONS) {
      let guide = answer(startGuide(), grade);
      for (let step = 2; step <= 5; step += 1) {
        shown.add(JSON.stringify(guideMessage(guide)));
        guide = next(guide, T0);
      }
    }
    for (const line of GUIDE_SCRIPT) {
      expect(shown.has(JSON.stringify(line.lines)), line.id).toBe(true);
    }
  });
});

describe('beze změny zůstávají tlačítka a odpovědi (#50 AC1)', () => {
  it('tlačítka jsou dál Zpět, Další, Přeskočit a Začít hrát', () => {
    expect(GUIDE_TEXTS.buttons).toEqual({
      back: 'Zpět',
      next: 'Další',
      skip: 'Přeskočit',
      startPlaying: 'Začít hrát',
    });
  });

  it('odpovědi na kroku 1 jsou dál Školka, 1. třída, 2. třída a výš', () => {
    expect(GRADE_OPTIONS.map((grade) => GUIDE_TEXTS.grades[grade])).toEqual([
      'Školka',
      '1. třída',
      '2. třída a výš',
    ]);
  });
});
