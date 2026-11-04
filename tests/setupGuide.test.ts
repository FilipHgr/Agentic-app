import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import type { SettingsRowKind } from '../src/logic/settingsLayout';
import type { SelectedOptions } from '../src/logic/settingsSession';
import {
  GUIDE_TEXTS,
  back,
  canOpenSettingsByHold,
  canStartPlaying,
  chooseOption,
  finishGuide,
  guideMessage,
  guideRowStyle,
  guideSelection,
  guideStep,
  hasBackButton,
  next,
  rightButton,
  startGuide,
  stepIndicatorText,
} from '../src/logic/setupGuide';
import type { GuideState } from '../src/logic/setupGuide';

/**
 * Testy k #49 (průvodce nastavením pro rodiče při prvním spuštění) ve znění
 * po úpravě: bez otázky na třídu začíná průvodce rovnou řadou „Do kolika“
 * (AC1), předvyplní výchozí nastavení (AC2), kroky 1–3 po řadách a jedna
 * rada pro každou řadu (AC3), shrnutí na kroku 4 a konec průvodce (AC4)
 * a podržení kolečka během průvodce (AC6). Texty jsou podle scénáře z #50
 * (`guideScript.test.ts`). Čas se předává parametrem, testy nečekají.
 * Načtení a uložení v zařízení je v `firstLaunch.test.ts`, rozložení (AC5)
 * v `setupGuideLayout.test.ts`. Odezva a zvuk (AC7) se kontrolují ručně.
 */

/** Pojistka: tak dlouho po zobrazení shrnutí „Začít hrát“ nereaguje. */
const START_LOCK_MS = 500;

const T0 = 10_000;
const SUMMARY_STEP = 4;

const ROWS: readonly SettingsRowKind[] = ['maxNumber', 'operations', 'answerInput'];

/** Předvyplněné volby, které rodič uvidí na začátku: 10 / + / 123. */
const DEFAULT_CHOICE: SelectedOptions = {
  maxNumber: 10,
  operations: 'plus',
  answerInput: 'keypad',
};

/** Volby úplně jiné než výchozí, aby bylo vidět, co se přepsalo. */
const PARENT_CHANGES: Required<GameSettings> = {
  maxNumber: 20,
  operations: 'minus',
  answerInput: 'writing',
};

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

describe('průvodce začíná rovnou řadou „Do kolika“ (#49 AC1)', () => {
  it('průvodce začíná na kroku 1 ze 4', () => {
    const guide = startGuide();
    expect(guideStep(guide)).toBe(1);
    expect(stepIndicatorText(guide)).toBe('1 / 4');
  });

  it('na kroku 1 je zvýrazněná řada „Do kolika“ a rodič ji hned může měnit', () => {
    const guide = startGuide();
    expect(guideRowStyle(guide, 'maxNumber')).toEqual({
      visible: true,
      opacity: 1,
      framed: true,
      tappable: true,
    });
    expect(guideSelection(chooseOption(guide, { maxNumber: 5 })).maxNumber).toBe(5);
  });

  it('na kroku 1 je hned vidět vysvětlení a rada k řadě „Do kolika“', () => {
    expect(guideMessage(startGuide())).toEqual([
      'Největší číslo, které se v příkladech objeví.',
      'Začněte menším číslem a přidávejte, až to dítě zvládá.',
    ]);
  });

  it('průvodce nikde nenabízí ✓ z #47, jen „Další“ nebo „Začít hrát“', () => {
    let guide = startGuide();
    const seen: string[] = [];
    for (let step = 1; step <= SUMMARY_STEP; step += 1) {
      seen.push(rightButton(guide));
      guide = next(guide, T0 + 1000);
    }
    for (const button of seen) {
      expect(['next', 'startPlaying']).toContain(button);
    }
  });

  it('průvodce nemá tlačítko „Přeskočit“', () => {
    expect(Object.values(GUIDE_TEXTS.buttons)).not.toContain('Přeskočit');
    expect(GUIDE_TEXTS.buttons).toEqual({
      back: 'Zpět',
      next: 'Další',
      startPlaying: 'Začít hrát',
    });
  });
});

describe('předvyplněné je výchozí nastavení (#49 AC2)', () => {
  it('na začátku je vybráno do 10, sčítání a číselník', () => {
    expect(guideSelection(startGuide())).toEqual(DEFAULT_CHOICE);
  });

  it('předvyplnění odpovídá výchozímu nastavení hry s číselníkem', () => {
    expect(guideSelection(startGuide())).toEqual({ answerInput: 'keypad', ...DEFAULT_SETTINGS });
  });

  it('předvyplnění vydrží do shrnutí, když rodič nic nemění', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP);
    expect(guideSelection(summary)).toEqual(DEFAULT_CHOICE);
  });

  it('každé nové spuštění průvodce začne zase s výchozím nastavením', () => {
    chooseOption(startGuide(), PARENT_CHANGES);
    expect(guideSelection(startGuide())).toEqual(DEFAULT_CHOICE);
  });
});

describe('kroky 1 Do kolika, 2 Příklady, 3 Odpověď a ukazatel „k / 4“ (#49 AC3)', () => {
  const stepRows: readonly [number, SettingsRowKind][] = [
    [1, 'maxNumber'],
    [2, 'operations'],
    [3, 'answerInput'],
  ];

  for (const [step, focused] of stepRows) {
    it(`na kroku ${step} ze 4 je zvýrazněná řada ${focused}: plně vidět a v rámečku`, () => {
      const guide = nextUntil(startGuide(), step);
      expect(guideStep(guide)).toBe(step);
      expect(stepIndicatorText(guide)).toBe(`${step} / 4`);
      const style = guideRowStyle(guide, focused);
      expect(style).toEqual({ visible: true, opacity: 1, framed: true, tappable: true });
    });

    it(`na kroku ${step} mají ostatní řady i popisky průhlednost 0,5 (#53), bez rámečku a nereagují`, () => {
      const guide = nextUntil(startGuide(), step);
      for (const row of ROWS.filter((kind) => kind !== focused)) {
        const style = guideRowStyle(guide, row);
        expect(style, row).toEqual({ visible: true, opacity: 0.5, framed: false, tappable: false });
      }
    });
  }

  it('ťuknutí na ztlumenou řadu nic nezmění', () => {
    const step1 = startGuide();
    expect(guideSelection(chooseOption(step1, { operations: 'minus' }))).toEqual(DEFAULT_CHOICE);
    expect(guideSelection(chooseOption(step1, { answerInput: 'writing' }))).toEqual(DEFAULT_CHOICE);

    const step2 = next(step1, T0);
    expect(guideSelection(chooseOption(step2, { maxNumber: 20 }))).toEqual(DEFAULT_CHOICE);
    expect(guideSelection(chooseOption(step2, { answerInput: 'writing' }))).toEqual(DEFAULT_CHOICE);

    const step3 = next(step2, T0);
    expect(guideSelection(chooseOption(step3, { maxNumber: 20 }))).toEqual(DEFAULT_CHOICE);
    expect(guideSelection(chooseOption(step3, { operations: 'minus' }))).toEqual(DEFAULT_CHOICE);
  });

  it('volbu zvýrazněné řady rodič změní ťuknutím jako v #47', () => {
    let guide = chooseOption(startGuide(), { maxNumber: 5 });
    expect(guideSelection(guide).maxNumber).toBe(5);

    guide = chooseOption(next(guide, T0), { operations: 'minus' });
    expect(guideSelection(guide).operations).toBe('minus');

    guide = chooseOption(next(guide, T0), { answerInput: 'writing' });
    expect(guideSelection(guide)).toEqual({
      maxNumber: 5,
      operations: 'minus',
      answerInput: 'writing',
    });
  });

  it('na kroku 1 „Zpět“ chybí a vpravo je „Další“', () => {
    const guide = startGuide();
    expect(hasBackButton(guide)).toBe(false);
    expect(rightButton(guide)).toBe('next');
    expect(GUIDE_TEXTS.buttons.next).toBe('Další');
  });

  it('„Zpět“ na kroku 1 nic neudělá', () => {
    const guide = chooseOption(startGuide(), { maxNumber: 20 });
    expect(back(guide)).toEqual(guide);
  });

  it('na krocích 2 a 3 jsou vidět „Zpět“ a „Další“', () => {
    let guide = next(startGuide(), T0);
    for (let step = 2; step <= 3; step += 1) {
      expect(guideStep(guide)).toBe(step);
      expect(hasBackButton(guide)).toBe(true);
      expect(rightButton(guide)).toBe('next');
      guide = next(guide, T0);
    }
    expect(GUIDE_TEXTS.buttons.back).toBe('Zpět');
  });

  it('každý krok 1–3 ukazuje dva řádky: co řada dělá a jednu radu', () => {
    const expected: Record<SettingsRowKind, [string, string]> = {
      maxNumber: [
        'Největší číslo, které se v příkladech objeví.',
        'Začněte menším číslem a přidávejte, až to dítě zvládá.',
      ],
      operations: [
        'Sčítání, odčítání, nebo obojí zamíchané.',
        'Začněte sčítáním. Obojí, až dítě zvládne odčítat.',
      ],
      answerInput: [
        'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
        'Tužku zvolte, až dítě umí psát všechny číslice.',
      ],
    };
    let guide = startGuide();
    for (const row of ROWS) {
      expect(guideMessage(guide), row).toEqual(expected[row]);
      guide = next(guide, T0);
    }
  });

  it('rada zůstane stejná, i když rodič vybere jinou volbu', () => {
    const step1 = startGuide();
    const changed = chooseOption(step1, { maxNumber: 20 });
    expect(guideMessage(changed)).toEqual(guideMessage(step1));

    const step3 = nextUntil(startGuide(), 3);
    expect(guideMessage(chooseOption(step3, { answerInput: 'writing' }))).toEqual(
      guideMessage(step3),
    );
  });

  it('„Zpět“ vrátí o jeden krok a vybrané volby zůstanou', () => {
    let guide = chooseOption(startGuide(), { maxNumber: 20 });
    guide = chooseOption(next(guide, T0), { operations: 'minus' });
    guide = chooseOption(next(guide, T0), { answerInput: 'writing' });

    guide = back(guide);
    expect(guideStep(guide)).toBe(2);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);

    guide = back(guide);
    expect(guideStep(guide)).toBe(1);
    expect(guideSelection(guide)).toEqual(PARENT_CHANGES);
  });

  it('po návratu na krok 1 je zase vpravo „Další“ a „Zpět“ chybí', () => {
    const guide = backUntil(nextUntil(startGuide(), SUMMARY_STEP), 1);
    expect(guideStep(guide)).toBe(1);
    expect(rightButton(guide)).toBe('next');
    expect(hasBackButton(guide)).toBe(false);
  });

  it('dvě ťuknutí na „Další“ těsně po sobě posunou o dva kroky', () => {
    const twice = next(next(startGuide(), T0 + 1000), T0 + 1000);
    expect(guideStep(twice)).toBe(3);
  });

  it('každé ťuknutí na „Další“ posune o jeden krok, nejdál na shrnutí', () => {
    let guide = startGuide();
    const steps: number[] = [];
    for (let tap = 0; tap < 6; tap += 1) {
      guide = next(guide, T0 + 1000 + tap);
      steps.push(guideStep(guide));
    }
    expect(steps).toEqual([2, 3, 4, 4, 4, 4]);
  });

  it('„Další“ volby nemění', () => {
    const guide = nextUntil(chooseOption(startGuide(), { maxNumber: 20 }), SUMMARY_STEP);
    expect(guideSelection(guide)).toEqual({ ...DEFAULT_CHOICE, maxNumber: 20 });
  });
});

describe('shrnutí na kroku 4 ze 4 a konec průvodce (#49 AC4)', () => {
  it('na shrnutí jsou všechny tři řady plně vidět, bez rámečku a jdou měnit', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP);
    expect(stepIndicatorText(summary)).toBe('4 / 4');
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
    const summary = nextUntil(startGuide(), SUMMARY_STEP);
    expect(guideMessage(summary)).toEqual([
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ]);
  });

  it('na shrnutí je vpravo „Začít hrát“ a vlevo „Zpět“', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP);
    expect(rightButton(summary)).toBe('startPlaying');
    expect(GUIDE_TEXTS.buttons.startPlaying).toBe('Začít hrát');
    expect(hasBackButton(summary)).toBe(true);
  });

  it('„Zpět“ ze shrnutí vede na krok 3 s řadou „Odpověď“', () => {
    const guide = back(nextUntil(startGuide(), SUMMARY_STEP));
    expect(guideStep(guide)).toBe(3);
    expect(stepIndicatorText(guide)).toBe('3 / 4');
    expect(guideRowStyle(guide, 'answerInput').framed).toBe(true);
  });

  it('„Zpět“ ze shrnutí nechá volby, které rodič na shrnutí nastavil', () => {
    let summary = nextUntil(startGuide(), SUMMARY_STEP);
    summary = chooseOption(summary, PARENT_CHANGES);
    expect(guideSelection(back(summary))).toEqual(PARENT_CHANGES);
  });

  it('ťuknutí na „Začít hrát“ v prvních 500 ms po zobrazení shrnutí nic neudělá', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP, T0 + 1000);
    for (const now of [T0 + 1000, T0 + 1200, T0 + 1000 + START_LOCK_MS - 1]) {
      expect(canStartPlaying(summary, now), String(now)).toBe(false);
      expect(finishGuide(summary, now), String(now)).toBeNull();
    }
  });

  it('500 ms po zobrazení shrnutí „Začít hrát“ zareaguje', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP, T0 + 1000);
    expect(canStartPlaying(summary, T0 + 1000 + START_LOCK_MS)).toBe(true);
    expect(finishGuide(summary, T0 + 1000 + START_LOCK_MS)).not.toBeNull();
  });

  it('pojistka se počítá od zobrazení shrnutí, ne od začátku průvodce', () => {
    let guide = next(startGuide(), T0);
    guide = next(guide, T0 + 5000);
    const summary = next(guide, T0 + 10_000);
    expect(canStartPlaying(summary, T0 + 10_000 + START_LOCK_MS - 1)).toBe(false);
    expect(canStartPlaying(summary, T0 + 10_000 + START_LOCK_MS)).toBe(true);
  });

  it('po návratu na shrnutí se pojistka 500 ms počítá znovu', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP, T0);
    const again = next(back(summary), T0 + 5000);
    expect(guideStep(again)).toBe(SUMMARY_STEP);
    expect(canStartPlaying(again, T0 + 5000 + START_LOCK_MS - 1)).toBe(false);
    expect(canStartPlaying(again, T0 + 5000 + START_LOCK_MS)).toBe(true);
  });

  it('na krocích 1 až 3 „Začít hrát“ není a průvodce nejde dokončit', () => {
    let guide = startGuide();
    for (let step = 1; step <= 3; step += 1) {
      expect(canStartPlaying(guide, T0 + 60_000), String(step)).toBe(false);
      expect(finishGuide(guide, T0 + 60_000), String(step)).toBeNull();
      guide = next(guide, T0);
    }
  });

  it('po „Začít hrát“ vrátí průvodce celé nastavení, i když rodič nic nezměnil', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP, T0);
    expect(finishGuide(summary, T0 + START_LOCK_MS)).toEqual(DEFAULT_CHOICE);
  });

  it('po „Začít hrát“ platí volby, které rodič nastavil v krocích i na shrnutí', () => {
    let guide = chooseOption(startGuide(), { maxNumber: 5 });
    guide = nextUntil(guide, SUMMARY_STEP, T0);
    guide = chooseOption(guide, { answerInput: 'writing' });
    expect(finishGuide(guide, T0 + START_LOCK_MS)).toEqual({
      maxNumber: 5,
      operations: 'plus',
      answerInput: 'writing',
    });
  });

  it('nastavení z průvodce obsahuje jen rozsah, druh příkladů a způsob odpovědi', () => {
    const summary = nextUntil(startGuide(), SUMMARY_STEP, T0);
    const settings = finishGuide(summary, T0 + START_LOCK_MS);
    expect(Object.keys(settings ?? {}).sort()).toEqual(['answerInput', 'maxNumber', 'operations']);
  });

  it('průvodce nemění předaný stav, každá akce vrací nový', () => {
    const start = startGuide();
    const snapshot = structuredClone(start);
    next(start, T0);
    chooseOption(start, PARENT_CHANGES);
    const summary = nextUntil(start, SUMMARY_STEP);
    const summarySnapshot = structuredClone(summary);
    back(summary);
    chooseOption(summary, PARENT_CHANGES);
    finishGuide(summary, T0 + START_LOCK_MS);
    expect(start).toEqual(snapshot);
    expect(summary).toEqual(summarySnapshot);
  });
});

describe('kolečko během průvodce (#49 AC6)', () => {
  it('podržení kolečka během průvodce nic neudělá v žádném kroku', () => {
    let guide = startGuide();
    for (let step = 1; step <= SUMMARY_STEP; step += 1) {
      expect(canOpenSettingsByHold(guide), String(step)).toBe(false);
      guide = next(guide, T0);
    }
  });

  it('bez průvodce kolečko nastavení otevře', () => {
    expect(canOpenSettingsByHold(null)).toBe(true);
  });
});
