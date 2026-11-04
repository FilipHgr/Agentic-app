import { describe, expect, it } from 'vitest';

import type { GameSettings } from '../src/logic/settings';
import type { SettingsRowKind } from '../src/logic/settingsLayout';
import type { SelectedOptions } from '../src/logic/settingsSession';
import {
  ADVICE,
  GRADE_OPTIONS,
  GUIDE_TEXTS,
  back,
  canOpenSettingsByHold,
  canStartPlaying,
  chooseGrade,
  chooseOption,
  finishGuide,
  guideMessage,
  guideRowStyle,
  guideSelection,
  guideStep,
  hasBackButton,
  next,
  rightButton,
  selectedGrade,
  skip,
  startGuide,
  stepIndicatorText,
  tickGuide,
} from '../src/logic/setupGuide';
import type { Grade, GuideState } from '../src/logic/setupGuide';

/**
 * Testy k #49 (průvodce nastavením pro rodiče při prvním spuštění): úvodní
 * otázka (AC1), předvyplnění podle odpovědi (AC2), kroky po řadách (AC3),
 * shrnutí, Přeskočit a konec průvodce (AC4) a podržení kolečka během
 * průvodce (AC6). Čas se předává parametrem, testy nečekají. Načtení
 * a uložení v zařízení je v `firstLaunch.test.ts`, rozložení (AC5)
 * v `setupGuideLayout.test.ts`. Žluté zvýraznění odpovědi, odezva
 * a zvuk (AC7) se kontrolují ručně.
 */

/** Jak dlouho zůstane ťuknutá odpověď zvýrazněná, než průvodce přejde dál. */
const HIGHLIGHT_MS = 300;
/** Pojistka: tak dlouho po zobrazení shrnutí „Začít hrát“ nereaguje. */
const START_LOCK_MS = 500;

const T0 = 10_000;

const ROWS: readonly SettingsRowKind[] = ['maxNumber', 'operations', 'answerInput'];

/** Výchozí volby, které rodič uvidí po „Přeskočit“: 10 / + / 123. */
const DEFAULT_CHOICE: SelectedOptions = {
  maxNumber: 10,
  operations: 'plus',
  answerInput: 'keypad',
};

const PRESETS: Record<Grade, SelectedOptions> = {
  preschool: { maxNumber: 5, operations: 'plus', answerInput: 'keypad' },
  firstGrade: { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' },
  secondGradeOrHigher: { maxNumber: 20, operations: 'mixed', answerInput: 'writing' },
};

/** Volby úplně jiné než všechny předvolby, aby bylo vidět, co se přepsalo. */
const PARENT_CHANGES: Required<GameSettings> = {
  maxNumber: 20,
  operations: 'minus',
  answerInput: 'writing',
};

/** Rodič ťukne na odpověď v čase `now` a počká, až průvodce přejde dál. */
function answer(state: GuideState, grade: Grade, now: number = T0): GuideState {
  return tickGuide(chooseGrade(state, grade, now), now + HIGHLIGHT_MS);
}

/** Rodič ťuká na „Další“, dokud nedojde na krok `step`. */
function nextUntil(state: GuideState, step: number, now: number = T0): GuideState {
  let current = state;
  for (let tap = 0; tap < 5 && guideStep(current) < step; tap += 1) {
    current = next(current, now);
  }
  return current;
}

/** Rodič ťuká na „Zpět“, dokud nedojde na krok `step`. */
function backUntil(state: GuideState, step: number): GuideState {
  let current = state;
  for (let tap = 0; tap < 5 && guideStep(current) > step; tap += 1) {
    current = back(current);
  }
  return current;
}

describe('úvodní otázka na kroku 1 z 5 (#49 AC1)', () => {
  it('průvodce začíná na kroku 1 z 5 bez vybrané odpovědi', () => {
    const guide = startGuide();
    expect(guideStep(guide)).toBe(1);
    expect(stepIndicatorText(guide)).toBe('1 / 5');
    expect(selectedGrade(guide)).toBeNull();
  });

  it('rodič vidí otázku „Do které třídy dítě chodí?“ a vysvětlivku pod ní', () => {
    expect(GUIDE_TEXTS.question).toBe('Do které třídy dítě chodí?');
    expect(GUIDE_TEXTS.questionNote).toBe('Podle odpovědi hru předvyplníme. Odpověď se neukládá.');
  });

  it('rodič vybírá ze tří odpovědí: Školka, 1. třída, 2. třída a výš', () => {
    expect(GRADE_OPTIONS.map((grade) => GUIDE_TEXTS.grades[grade])).toEqual([
      'Školka',
      '1. třída',
      '2. třída a výš',
    ]);
  });

  it('na kroku 1 nejsou vidět řady voleb a ťuknutí na jejich místo nic nezmění', () => {
    const guide = startGuide();
    for (const row of ROWS) {
      expect(guideRowStyle(guide, row).visible, row).toBe(false);
      expect(guideRowStyle(guide, row).tappable, row).toBe(false);
    }
    const tapped = chooseOption(guide, { maxNumber: 5 });
    expect(guideSelection(tapped)).toEqual(DEFAULT_CHOICE);
  });

  it('na kroku 1 nejsou žádná vysvětlení ani rady pod řadami', () => {
    expect(guideMessage(startGuide())).toBeNull();
  });

  it('bez vybrané odpovědi je vpravo „Přeskočit“ a „Zpět“ chybí', () => {
    const guide = startGuide();
    expect(rightButton(guide)).toBe('skip');
    expect(GUIDE_TEXTS.buttons.skip).toBe('Přeskočit');
    expect(hasBackButton(guide)).toBe(false);
  });

  it('ťuknutá odpověď je hned vybraná, ale průvodce zůstane 300 ms na kroku 1', () => {
    let guide = chooseGrade(startGuide(), 'firstGrade', T0);
    expect(selectedGrade(guide)).toBe('firstGrade');
    expect(guideStep(guide)).toBe(1);

    guide = tickGuide(guide, T0 + HIGHLIGHT_MS - 1);
    expect(guideStep(guide)).toBe(1);
  });

  it('300 ms po ťuknutí na odpověď přejde průvodce na krok 2', () => {
    const guide = tickGuide(chooseGrade(startGuide(), 'firstGrade', T0), T0 + HIGHLIGHT_MS);
    expect(guideStep(guide)).toBe(2);
    expect(stepIndicatorText(guide)).toBe('2 / 5');
  });

  it('i když hra dostane čas až později, průvodce přejde jen o jeden krok', () => {
    const guide = tickGuide(chooseGrade(startGuide(), 'firstGrade', T0), T0 + 5000);
    expect(guideStep(guide)).toBe(2);
  });

  it('ťuknutí na jinou odpověď během těch 300 ms nic neudělá', () => {
    let guide = chooseGrade(startGuide(), 'preschool', T0);
    guide = chooseGrade(guide, 'secondGradeOrHigher', T0 + 100);
    expect(selectedGrade(guide)).toBe('preschool');

    guide = tickGuide(guide, T0 + HIGHLIGHT_MS);
    expect(guideStep(guide)).toBe(2);
    expect(selectedGrade(guide)).toBe('preschool');
    expect(guideSelection(guide)).toEqual(PRESETS.preschool);
  });

  it('opakované ťuknutí na stejnou odpověď během 300 ms čekání neprodlouží', () => {
    let guide = chooseGrade(startGuide(), 'preschool', T0);
    guide = chooseGrade(guide, 'preschool', T0 + 200);
    guide = tickGuide(guide, T0 + HIGHLIGHT_MS);
    expect(guideStep(guide)).toBe(2);
  });

  it('ťuknutí na pravé tlačítko během 300 ms nic neudělá a krok 2 se nepřeskočí', () => {
    let guide = chooseGrade(startGuide(), 'preschool', T0);
    guide = next(guide, T0 + 100);
    guide = skip(guide, T0 + 150);
    expect(guideStep(guide)).toBe(1);

    guide = tickGuide(guide, T0 + HIGHLIGHT_MS);
    expect(guideStep(guide)).toBe(2);
  });

  it('po návratu „Zpět“ z kroku 2 je odpověď vybraná, vpravo „Další“ a „Zpět“ chybí', () => {
    const guide = back(answer(startGuide(), 'firstGrade'));
    expect(guideStep(guide)).toBe(1);
    expect(selectedGrade(guide)).toBe('firstGrade');
    expect(rightButton(guide)).toBe('next');
    expect(GUIDE_TEXTS.buttons.next).toBe('Další');
    expect(hasBackButton(guide)).toBe(false);
  });

  it('po návratu „Zpět“ na krok 1 průvodce sám dál nepřejde', () => {
    const guide = tickGuide(back(answer(startGuide(), 'firstGrade')), T0 + 60_000);
    expect(guideStep(guide)).toBe(1);
  });

  it('„Další“ na kroku 1 vede na krok 2 a volby nechá, jak jsou', () => {
    let guide = answer(startGuide(), 'firstGrade');
    guide = chooseOption(guide, { maxNumber: 20 });
    guide = next(back(guide), T0 + 1000);
    expect(guideStep(guide)).toBe(2);
    expect(guideSelection(guide)).toEqual({ ...PRESETS.firstGrade, maxNumber: 20 });
  });

  it('„Přeskočit“ s vybranou odpovědí nic neudělá, takže úpravy rodiče nepřepíše', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: 20 });
    guide = skip(back(guide), T0 + 1000);
    expect(guideStep(guide)).toBe(1);
    expect(guideSelection(guide)).toEqual({ ...PRESETS.preschool, maxNumber: 20 });
  });

  it('bez vybrané odpovědi „Další“ na kroku 1 nic neudělá', () => {
    expect(guideStep(next(startGuide(), T0))).toBe(1);
  });

  it('„Zpět“ na kroku 1 nic neudělá', () => {
    const guide = startGuide();
    expect(back(guide)).toEqual(guide);
  });

  it('po cestě Přeskočit → shrnutí → Zpět není vybraná žádná odpověď a vpravo je „Přeskočit“', () => {
    const guide = back(skip(startGuide(), T0));
    expect(guideStep(guide)).toBe(1);
    expect(selectedGrade(guide)).toBeNull();
    expect(rightButton(guide)).toBe('skip');
    expect(hasBackButton(guide)).toBe(false);
  });

  it('průvodce nikde nenabízí ✓ z #47, jen „Přeskočit“, „Další“ nebo „Začít hrát“', () => {
    let guide = answer(startGuide(), 'firstGrade');
    const seen = [rightButton(back(guide))];
    for (let step = 2; step <= 5; step += 1) {
      seen.push(rightButton(guide));
      guide = next(guide, T0 + 1000);
    }
    seen.push(rightButton(startGuide()));
    for (const button of seen) {
      expect(['skip', 'next', 'startPlaying']).toContain(button);
    }
  });
});

describe('předvyplnění podle odpovědi (#49 AC2)', () => {
  const cases: readonly [Grade, SelectedOptions][] = [
    ['preschool', { maxNumber: 5, operations: 'plus', answerInput: 'keypad' }],
    ['firstGrade', { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' }],
    ['secondGradeOrHigher', { maxNumber: 20, operations: 'mixed', answerInput: 'writing' }],
  ];

  for (const [grade, expected] of cases) {
    it(`po odpovědi „${GUIDE_TEXTS.grades[grade]}“ jsou předvyplněné ${expected.maxNumber} / ${expected.operations} / ${expected.answerInput}`, () => {
      expect(guideSelection(answer(startGuide(), grade))).toEqual(expected);
    });
  }

  it('předvyplnění vydrží do shrnutí, když rodič nic nemění', () => {
    for (const grade of GRADE_OPTIONS) {
      const summary = nextUntil(answer(startGuide(), grade), 5);
      expect(guideSelection(summary), grade).toEqual(PRESETS[grade]);
    }
  });

  it('ťuknutí na jinou odpověď po návratu předvyplní znovu všechny tři řady', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: PARENT_CHANGES.maxNumber });
    guide = chooseOption(next(guide, T0), { operations: PARENT_CHANGES.operations });
    guide = chooseOption(next(guide, T0), { answerInput: PARENT_CHANGES.answerInput });
    guide = backUntil(guide, 1);

    guide = answer(guide, 'firstGrade', T0 + 2000);
    expect(selectedGrade(guide)).toBe('firstGrade');
    expect(guideSelection(guide)).toEqual(PRESETS.firstGrade);
  });

  it('ťuknutí na stejnou odpověď po návratu nechá dřívější změny rodiče ve všech řadách', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: PARENT_CHANGES.maxNumber });
    guide = chooseOption(next(guide, T0), { operations: PARENT_CHANGES.operations });
    guide = chooseOption(next(guide, T0), { answerInput: PARENT_CHANGES.answerInput });
    guide = backUntil(guide, 1);

    guide = answer(guide, 'preschool', T0 + 2000);
    expect(guideStep(guide)).toBe(2);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);
  });

  it('po ťuknutí na stejnou odpověď průvodce zase za 300 ms přejde na krok 2', () => {
    let guide = back(answer(startGuide(), 'firstGrade'));
    guide = chooseGrade(guide, 'firstGrade', T0 + 2000);
    expect(guideStep(tickGuide(guide, T0 + 2000 + HIGHLIGHT_MS - 1))).toBe(1);
    expect(guideStep(tickGuide(guide, T0 + 2000 + HIGHLIGHT_MS))).toBe(2);
  });

  it('první odpověď po cestě Přeskočit → shrnutí → Zpět předvyplní všechny řady', () => {
    let guide = skip(startGuide(), T0);
    guide = chooseOption(guide, PARENT_CHANGES);
    guide = back(guide);

    guide = answer(guide, 'preschool', T0 + 2000);
    expect(guideSelection(guide)).toEqual(PRESETS.preschool);
  });
});

describe('kroky po řadách: 2 Do kolika, 3 Příklady, 4 Odpověď (#49 AC3)', () => {
  const stepRows: readonly [number, SettingsRowKind][] = [
    [2, 'maxNumber'],
    [3, 'operations'],
    [4, 'answerInput'],
  ];

  for (const [step, focused] of stepRows) {
    it(`na kroku ${step} z 5 je zvýrazněná řada ${focused}: plně vidět a v rámečku`, () => {
      const guide = nextUntil(answer(startGuide(), 'firstGrade'), step);
      expect(guideStep(guide)).toBe(step);
      expect(stepIndicatorText(guide)).toBe(`${step} / 5`);
      const style = guideRowStyle(guide, focused);
      expect(style).toEqual({ visible: true, opacity: 1, framed: true, tappable: true });
    });

    it(`na kroku ${step} mají ostatní řady i popisky průhlednost 0,3, bez rámečku a nereagují`, () => {
      const guide = nextUntil(answer(startGuide(), 'firstGrade'), step);
      for (const row of ROWS.filter((kind) => kind !== focused)) {
        const style = guideRowStyle(guide, row);
        expect(style, row).toEqual({ visible: true, opacity: 0.3, framed: false, tappable: false });
      }
    });
  }

  it('ťuknutí na ztlumenou řadu nic nezmění', () => {
    const step2 = answer(startGuide(), 'preschool');
    expect(guideSelection(chooseOption(step2, { operations: 'minus' }))).toEqual(PRESETS.preschool);
    expect(guideSelection(chooseOption(step2, { answerInput: 'writing' }))).toEqual(
      PRESETS.preschool,
    );

    const step3 = next(step2, T0);
    expect(guideSelection(chooseOption(step3, { maxNumber: 20 }))).toEqual(PRESETS.preschool);
    expect(guideSelection(chooseOption(step3, { answerInput: 'writing' }))).toEqual(
      PRESETS.preschool,
    );

    const step4 = next(step3, T0);
    expect(guideSelection(chooseOption(step4, { maxNumber: 20 }))).toEqual(PRESETS.preschool);
    expect(guideSelection(chooseOption(step4, { operations: 'minus' }))).toEqual(PRESETS.preschool);
  });

  it('volbu zvýrazněné řady rodič změní ťuknutím jako v #47', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: 10 });
    expect(guideSelection(guide).maxNumber).toBe(10);

    guide = chooseOption(next(guide, T0), { operations: 'minus' });
    expect(guideSelection(guide).operations).toBe('minus');

    guide = chooseOption(next(guide, T0), { answerInput: 'writing' });
    expect(guideSelection(guide)).toEqual({
      maxNumber: 10,
      operations: 'minus',
      answerInput: 'writing',
    });
  });

  it('na krocích 2 až 4 jsou vidět „Zpět“ a „Další“', () => {
    let guide = answer(startGuide(), 'firstGrade');
    for (let step = 2; step <= 4; step += 1) {
      expect(guideStep(guide)).toBe(step);
      expect(hasBackButton(guide)).toBe(true);
      expect(rightButton(guide)).toBe('next');
      guide = next(guide, T0);
    }
    expect(GUIDE_TEXTS.buttons.back).toBe('Zpět');
  });

  describe('pod řadami je vysvětlení řady a rada podle odpovědi', () => {
    const explanations: Record<SettingsRowKind, string> = {
      maxNumber: 'Největší číslo, které se v příkladech objeví.',
      operations: 'Sčítání, odčítání, nebo obojí zamíchané.',
      answerInput: '123: dítě ťuká na čísla. Tužka: píše výsledek prstem.',
    };
    const advice: Record<Grade, Record<SettingsRowKind, string>> = {
      preschool: {
        maxNumber: 'Doporučujeme 5. Ve školce dítě počítá na prstech ruky.',
        operations: 'Doporučujeme +. Přidávání je pro malé děti nejsnazší.',
        answerInput: 'Doporučujeme 123. Psát číslice se dítě teprve učí.',
      },
      firstGrade: {
        maxNumber: 'Doporučujeme 10. Ve 2. pololetí 1. třídy zkuste 20.',
        operations: 'Doporučujeme + −. V 1. třídě se učí obojí současně.',
        answerInput: 'Doporučujeme 123. Tužku zvolte, až dítě umí psát 0–9.',
      },
      secondGradeOrHigher: {
        maxNumber: 'Doporučujeme 20. Víc hra nemá, procvičí přechod přes 10.',
        operations: 'Doporučujeme + −. Dítě musí sledovat znaménko.',
        answerInput: 'Doporučujeme tužku. Dítě si procvičí i psaní číslic.',
      },
    };

    it('rady jsou uložené jako data pro každou odpověď a řadu', () => {
      expect(ADVICE).toEqual(advice);
      expect(GUIDE_TEXTS.rowExplanations).toEqual(explanations);
    });

    for (const grade of GRADE_OPTIONS) {
      it(`po odpovědi „${GUIDE_TEXTS.grades[grade]}“ ukazuje každý krok dva řádky: co řada dělá a radu`, () => {
        let guide = answer(startGuide(), grade);
        for (const row of ROWS) {
          expect(guideMessage(guide), `${grade} ${row}`).toEqual([
            explanations[row],
            advice[grade][row],
          ]);
          guide = next(guide, T0);
        }
      });
    }
  });

  it('rada zůstane stejná, i když rodič vybere jinou volbu', () => {
    const step2 = answer(startGuide(), 'preschool');
    const before = guideMessage(step2);
    const changed = chooseOption(step2, { maxNumber: 20 });
    expect(guideMessage(changed)).toEqual(before);
    expect(guideMessage(changed)?.[1]).toBe(
      'Doporučujeme 5. Ve školce dítě počítá na prstech ruky.',
    );
  });

  it('po změně odpovědi na kroku 1 se rady řídí novou odpovědí', () => {
    let guide = back(answer(startGuide(), 'preschool'));
    guide = answer(guide, 'secondGradeOrHigher', T0 + 2000);
    expect(guideMessage(guide)?.[1]).toBe(
      'Doporučujeme 20. Víc hra nemá, procvičí přechod přes 10.',
    );
  });

  it('„Zpět“ vrátí o jeden krok a vybrané volby zůstanou', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: 20 });
    guide = chooseOption(next(guide, T0), { operations: 'minus' });
    guide = chooseOption(next(guide, T0), { answerInput: 'writing' });

    guide = back(guide);
    expect(guideStep(guide)).toBe(3);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);

    guide = back(guide);
    expect(guideStep(guide)).toBe(2);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);
  });

  it('„Zpět“ z kroku 2 vede na krok 1 s vybranou odpovědí a s „Další“', () => {
    const guide = back(chooseOption(answer(startGuide(), 'preschool'), { maxNumber: 20 }));
    expect(guideStep(guide)).toBe(1);
    expect(selectedGrade(guide)).toBe('preschool');
    expect(rightButton(guide)).toBe('next');
    expect(guideSelection(guide)).toEqual({ ...PRESETS.preschool, maxNumber: 20 });
  });

  it('dvě ťuknutí na „Další“ těsně po sobě posunou o dva kroky', () => {
    const step2 = answer(startGuide(), 'firstGrade');
    const twice = next(next(step2, T0 + 1000), T0 + 1000);
    expect(guideStep(twice)).toBe(4);
  });

  it('každé ťuknutí na „Další“ posune o jeden krok, nejdál na shrnutí', () => {
    let guide = answer(startGuide(), 'firstGrade');
    const steps: number[] = [];
    for (let tap = 0; tap < 6; tap += 1) {
      guide = next(guide, T0 + 1000 + tap);
      steps.push(guideStep(guide));
    }
    expect(steps).toEqual([3, 4, 5, 5, 5, 5]);
  });

  it('„Další“ volby nemění', () => {
    let guide = answer(startGuide(), 'preschool');
    guide = chooseOption(guide, { maxNumber: 20 });
    guide = nextUntil(guide, 5);
    expect(guideSelection(guide)).toEqual({ ...PRESETS.preschool, maxNumber: 20 });
  });
});

describe('shrnutí na kroku 5 z 5, Přeskočit a konec průvodce (#49 AC4)', () => {
  it('na shrnutí jsou všechny tři řady plně vidět, bez rámečku a jdou měnit', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5);
    expect(stepIndicatorText(summary)).toBe('5 / 5');
    for (const row of ROWS) {
      expect(guideRowStyle(summary, row), row).toEqual({
        visible: true,
        opacity: 1,
        framed: false,
        tappable: true,
      });
    }
    expect(guideSelection(chooseOption(summary, PARENT_CHANGES))).toEqual(PARENT_CHANGES);
  });

  it('na shrnutí je text, že volby jdou změnit teď i později kolečkem', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5);
    expect(guideMessage(summary)).toEqual([
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ]);
  });

  it('na shrnutí je vpravo „Začít hrát“ a vlevo „Zpět“', () => {
    const summary = skip(startGuide(), T0);
    expect(rightButton(summary)).toBe('startPlaying');
    expect(GUIDE_TEXTS.buttons.startPlaying).toBe('Začít hrát');
    expect(hasBackButton(summary)).toBe(true);
  });

  it('ťuknutí na „Začít hrát“ v prvních 500 ms po zobrazení shrnutí nic neudělá', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5, T0 + 1000);
    for (const now of [T0 + 1000, T0 + 1200, T0 + 1000 + START_LOCK_MS - 1]) {
      expect(canStartPlaying(summary, now), String(now)).toBe(false);
      expect(finishGuide(summary, now), String(now)).toBeNull();
    }
  });

  it('500 ms po zobrazení shrnutí „Začít hrát“ zareaguje', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5, T0 + 1000);
    expect(canStartPlaying(summary, T0 + 1000 + START_LOCK_MS)).toBe(true);
    expect(finishGuide(summary, T0 + 1000 + START_LOCK_MS)).not.toBeNull();
  });

  it('pojistka 500 ms platí i po „Přeskočit“', () => {
    const summary = skip(startGuide(), T0);
    expect(canStartPlaying(summary, T0 + START_LOCK_MS - 1)).toBe(false);
    expect(canStartPlaying(summary, T0 + START_LOCK_MS)).toBe(true);
  });

  it('po návratu na shrnutí se pojistka 500 ms počítá znovu', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5, T0);
    const again = next(back(summary), T0 + 5000);
    expect(guideStep(again)).toBe(5);
    expect(canStartPlaying(again, T0 + 5000 + START_LOCK_MS - 1)).toBe(false);
    expect(canStartPlaying(again, T0 + 5000 + START_LOCK_MS)).toBe(true);
  });

  it('na krocích 1 až 4 „Začít hrát“ není a průvodce nejde dokončit', () => {
    let guide = startGuide();
    expect(finishGuide(guide, T0 + 60_000)).toBeNull();
    guide = answer(guide, 'firstGrade');
    for (let step = 2; step <= 4; step += 1) {
      expect(canStartPlaying(guide, T0 + 60_000), String(step)).toBe(false);
      expect(finishGuide(guide, T0 + 60_000), String(step)).toBeNull();
      guide = next(guide, T0);
    }
  });

  it('po „Začít hrát“ vrátí průvodce celé nastavení, i když rodič nic nezměnil', () => {
    const summary = nextUntil(answer(startGuide(), 'secondGradeOrHigher'), 5, T0);
    expect(finishGuide(summary, T0 + START_LOCK_MS)).toEqual({
      maxNumber: 20,
      operations: 'mixed',
      answerInput: 'writing',
    });
  });

  it('po „Začít hrát“ platí volby, které rodič nastavil na shrnutí', () => {
    let summary = nextUntil(answer(startGuide(), 'preschool'), 5, T0);
    summary = chooseOption(summary, { maxNumber: 20, answerInput: 'writing' });
    expect(finishGuide(summary, T0 + START_LOCK_MS)).toEqual({
      maxNumber: 20,
      operations: 'plus',
      answerInput: 'writing',
    });
  });

  it('nastavení z průvodce neobsahuje odpověď na třídu', () => {
    const summary = nextUntil(answer(startGuide(), 'firstGrade'), 5, T0);
    const settings = finishGuide(summary, T0 + START_LOCK_MS);
    expect(Object.keys(settings ?? {}).sort()).toEqual(['answerInput', 'maxNumber', 'operations']);
  });

  it('„Přeskočit“ vede rovnou na shrnutí s výchozím 10 / + / 123', () => {
    const summary = skip(startGuide(), T0);
    expect(guideStep(summary)).toBe(5);
    expect(guideSelection(summary)).toEqual(DEFAULT_CHOICE);
    expect(finishGuide(summary, T0 + START_LOCK_MS)).toEqual(DEFAULT_CHOICE);
  });

  it('„Zpět“ ze shrnutí vede na krok 4', () => {
    const guide = back(nextUntil(answer(startGuide(), 'firstGrade'), 5));
    expect(guideStep(guide)).toBe(4);
  });

  it('„Zpět“ ze shrnutí po „Přeskočit“ vede na krok 1', () => {
    expect(guideStep(back(skip(startGuide(), T0)))).toBe(1);
  });

  it('Přeskočit → změna na shrnutí → Zpět → Přeskočit zachová volby rodiče', () => {
    let guide = skip(startGuide(), T0);
    guide = chooseOption(guide, PARENT_CHANGES);
    guide = back(guide);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);

    guide = skip(guide, T0 + 3000);
    expect(guideStep(guide)).toBe(5);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);
    expect(finishGuide(guide, T0 + 3000 + START_LOCK_MS)).toEqual(PARENT_CHANGES);
  });

  it('po Přeskočit → Zpět a odpovědi vede „Zpět“ ze shrnutí zase na krok 4', () => {
    let guide = back(skip(startGuide(), T0));
    guide = answer(guide, 'firstGrade', T0 + 2000);
    guide = nextUntil(guide, 5, T0 + 3000);
    expect(guideStep(back(guide))).toBe(4);
  });

  it('po Přeskočit → Zpět, odpovědi a návratu na krok 1 je vpravo „Další“', () => {
    let guide = back(skip(startGuide(), T0));
    guide = back(answer(guide, 'preschool', T0 + 2000));
    expect(selectedGrade(guide)).toBe('preschool');
    expect(rightButton(guide)).toBe('next');
  });

  it('průvodce nemění předaný stav, každá akce vrací nový', () => {
    const start = startGuide();
    const snapshot = structuredClone(start);
    chooseGrade(start, 'preschool', T0);
    skip(start, T0);
    next(start, T0);
    chooseOption(start, PARENT_CHANGES);
    expect(start).toEqual(snapshot);
  });
});

describe('kolečko během průvodce (#49 AC6)', () => {
  it('podržení kolečka během průvodce nic neudělá v žádném kroku', () => {
    let guide = startGuide();
    expect(canOpenSettingsByHold(guide)).toBe(false);
    guide = answer(guide, 'firstGrade');
    for (let step = 2; step <= 5; step += 1) {
      expect(canOpenSettingsByHold(guide), String(step)).toBe(false);
      guide = next(guide, T0);
    }
    expect(canOpenSettingsByHold(skip(startGuide(), T0))).toBe(false);
  });

  it('bez průvodce kolečko nastavení otevře', () => {
    expect(canOpenSettingsByHold(null)).toBe(true);
  });
});
