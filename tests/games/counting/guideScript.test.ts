import { describe, expect, it } from 'vitest';

import {
  GUIDE_SCRIPT,
  spokenText,
  voiceSentences,
} from '../../../src/games/counting/logic/guideScript';
import type { GuideLine } from '../../../src/games/counting/logic/guideScript';
import {
  GUIDE_TEXTS,
  back,
  guideMessage,
  next,
  startGuide,
} from '../../../src/games/counting/logic/setupGuide';
import type { GuideState } from '../../../src/games/counting/logic/setupGuide';

/**
 * Testy k #50 AC1 ve znění po zrušení otázky na třídu: věty průvodce podle
 * scénáře pro namluvení, jedna věta na krok, celkem 4. Scénář je jediný
 * zdroj vět pro hru i pro skript na nahrávky. Rozložení z #49 AC5 je
 * v `setupGuideLayout.test.ts`, chování průvodce v `setupGuide.test.ts`.
 */

const T0 = 10_000;
const MAX_LINE_CHARACTERS = 56;

/** Scénář ze zadání #50 (poslední komentář): id, krok a dva řádky. */
const EXPECTED_SCRIPT: readonly { id: string; step: number; lines: [string, string] }[] = [
  {
    id: 'maxNumber',
    step: 1,
    lines: [
      'Největší číslo, které se v příkladech objeví.',
      'Začněte menším číslem a přidávejte, až to dítě zvládá.',
    ],
  },
  {
    id: 'operations',
    step: 2,
    lines: [
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Začněte sčítáním. Obojí, až dítě zvládne odčítat.',
    ],
  },
  {
    id: 'answerInput',
    step: 3,
    lines: [
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Tužku zvolte, až dítě umí psát všechny číslice.',
    ],
  },
  {
    id: 'summary',
    step: 4,
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

/** Rodič ťuká na „Další“, dokud nedojde na krok `step`. */
function guideOnStep(step: number): GuideState {
  let guide = startGuide();
  for (let tap = 1; tap < step; tap += 1) {
    guide = next(guide, T0);
  }
  return guide;
}

describe('scénář průvodce (#50 AC1)', () => {
  it('scénář má přesně 4 věty ze zadání, každou se dvěma řádky', () => {
    expect(GUIDE_SCRIPT.map(({ id, step, lines }) => ({ id, step, lines: [...lines] }))).toEqual(
      EXPECTED_SCRIPT,
    );
  });

  it('každý krok 1–4 má právě jednu větu', () => {
    const countOnStep = (step: number) => GUIDE_SCRIPT.filter((line) => line.step === step).length;
    expect([1, 2, 3, 4].map(countOnStep)).toEqual([1, 1, 1, 1]);
  });

  it('každá věta má jiné id, aby měla svou vlastní nahrávku', () => {
    const ids = GUIDE_SCRIPT.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ve scénáři nejsou věty k otázce na třídu ani rady podle třídy', () => {
    const ids: string[] = GUIDE_SCRIPT.map((line) => line.id);
    expect(ids).not.toContain('question');
    for (const id of ids) {
      expect(id).not.toMatch(/\./);
    }
  });

  it('rada u „Do kolika“ nedoporučuje rozsah podle třídy ani školky', () => {
    const text = scriptLine('maxNumber').lines.join(' ');
    expect(text).not.toMatch(/třída/i);
    expect(text).not.toMatch(/školka/i);
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
    expect(scriptLine('answerInput').lines.join(' ')).toContain('číselník');
    expect(scriptLine('operations').lines.join(' ')).toContain('obojí');
  });
});

describe('mluvený text je stejný jako text na obrazovce (#50 AC1)', () => {
  it('v nahrávce zazní oba řádky věty za sebou', () => {
    for (const line of GUIDE_SCRIPT) {
      expect(spokenText(line)).toBe(`${line.lines[0]} ${line.lines[1]}`);
    }
  });

  it('skript na nahrávky dostane ze scénáře 4 věty s id a mluveným textem', () => {
    expect(voiceSentences()).toEqual(
      GUIDE_SCRIPT.map((line) => ({ id: line.id, text: spokenText(line) })),
    );
    expect(voiceSentences()).toHaveLength(4);
  });
});

describe('na obrazovce je přesně text ze scénáře (#50 AC1)', () => {
  const stepLines: readonly [number, string][] = [
    [1, 'maxNumber'],
    [2, 'operations'],
    [3, 'answerInput'],
    [4, 'summary'],
  ];

  for (const [step, id] of stepLines) {
    it(`na kroku ${step} je věta „${id}“ ze scénáře`, () => {
      expect(guideMessage(guideOnStep(step))).toEqual(scriptLine(id).lines);
    });
  }

  it('po „Zpět“ ze shrnutí je na kroku 3 zase věta „answerInput“', () => {
    expect(guideMessage(back(guideOnStep(4)))).toEqual(scriptLine('answerInput').lines);
  });

  it('každá věta ze scénáře se v průvodci ukáže, každá na jiném kroku', () => {
    const shown = [1, 2, 3, 4].map((step) => JSON.stringify(guideMessage(guideOnStep(step))));
    expect(new Set(shown).size).toBe(4);
    for (const line of GUIDE_SCRIPT) {
      expect(shown, line.id).toContain(JSON.stringify(line.lines));
    }
  });
});

describe('tlačítka průvodce (#50 AC1)', () => {
  it('tlačítka jsou Zpět, Další a Začít hrát, „Přeskočit“ už není', () => {
    expect(GUIDE_TEXTS.buttons).toEqual({
      back: 'Zpět',
      next: 'Další',
      startPlaying: 'Začít hrát',
    });
  });
});
