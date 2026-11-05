import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import type { Stroke } from '../src/logic/digitRecognition';
import {
  gameAreaFor,
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
  playStateAfterResize,
} from '../src/logic/deviceLayout';
import type { PlayState } from '../src/logic/deviceLayout';
import { countDot, startDotCounting } from '../src/logic/dotCounting';
import type { Problem } from '../src/logic/problems';
import { CLOSED_SETTINGS, openSettings } from '../src/logic/settingsSession';
import type { GameSettings } from '../src/logic/settings';
import { next, startGuide } from '../src/logic/setupGuide';
import {
  boxDigit,
  boxStrokes,
  canConfirmBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  startBoxStroke,
  updateBoxes,
} from '../src/logic/twoBoxWriting';
import type { TwoBoxRound } from '../src/logic/twoBoxWriting';
import {
  RECOGNITION_DELAY_MS,
  canConfirm,
  confirmWriting,
  createWritingRound,
  fadingStrokes,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from '../src/logic/writingRound';
import type { WritingRound } from '../src/logic/writingRound';
import { seededRandom } from './seededRandom';
import { NO_NOTCH, PHONE_WINDOWS, viewportOf } from './viewportFixtures';

/**
 * Testy k #54, AC7 (otočení telefonu a lišta prohlížeče): přepočet
 * rozložení je čistá funkce stavu a plochy. Rozehraný příklad, chyby,
 * nápověda, hvězdičky, postavička, otevřené nastavení i průvodce zůstanou,
 * nezapočítá se žádná odpověď a nepřijde nový příklad. Rozepsané tahy
 * v okénku se smažou bez chyby. Že scéna přepočet opravdu spustí při
 * otočení a změně lišty, se kontroluje ručně v náhledu.
 */

const SETTINGS_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };
const SETTINGS_5: GameSettings = { maxNumber: 5, operations: 'plus', answerInput: 'writing' };

/** Rozpoznávání, které vždy vrátí stejnou číslici, aby test nezávisel na vzorech. */
const alwaysSeven = (): number => 7;

const STROKE: Stroke = [
  { x: 10, y: 10 },
  { x: 40, y: 60 },
  { x: 80, y: 120 },
];

const SMALLER_AREA = { width: 300, height: 300 };

/** Kolo po dvou chybách: nápověda je vidět. */
function roundWithHint(settings: GameSettings): AnswerRound {
  const round = createAnswerRound(settings, seededRandom());
  const wrong = round.problem.result === 0 ? 1 : 0;
  const afterFirst = tapAnswer(round, wrong).round;
  return tapAnswer(afterFirst, wrong).round;
}

/** Jednociferné okénko s rozpoznanou číslicí, kterou šlo potvrdit. */
function writingWithDigit(answer: AnswerRound): WritingRound {
  const area = { width: 320, height: 320 };
  let writing = createWritingRound(answer, area, alwaysSeven);
  writing = startStroke(writing, 0);
  writing = finishStroke(writing, STROKE, 100);
  return updateWriting(writing, 100 + RECOGNITION_DELAY_MS);
}

/** Dvě okénka: v desítkách rozpoznaná číslice, v jednotkách rozepsaný tah. */
function twoBoxesMidWriting(answer: AnswerRound): TwoBoxRound {
  let boxes = createTwoBoxRound(answer, { width: 280, height: 280 }, alwaysSeven);
  boxes = startBoxStroke(boxes, 'tens', 0);
  boxes = finishBoxStroke(boxes, STROKE, 100);
  boxes = updateBoxes(boxes, 100 + RECOGNITION_DELAY_MS);
  return startBoxStroke(boxes, 'ones', 2000);
}

function playState(writing: WritingRound | TwoBoxRound | null, round: AnswerRound): PlayState {
  const counting = countDot(round, startDotCounting(round.problem), 0).counting;
  const settings = round.maxNumber === 5 ? SETTINGS_5 : SETTINGS_10;
  return {
    round,
    settings,
    progress: { earned: 7, character: 'robik' },
    counting,
    writing,
    settingsSession: openSettings(CLOSED_SETTINGS, settings),
    guide: next(startGuide(), 0),
  };
}

function isTwoBox(writing: WritingRound | TwoBoxRound | null): writing is TwoBoxRound {
  return writing !== null && 'tens' in writing;
}

describe('AC7: otočení telefonu nebo změna lišty nezmění rozehrané kolo', () => {
  it('zůstane stejný příklad, počet chyb, nápověda, hvězdičky, postavička, nastavení i průvodce', () => {
    const round = roundWithHint(SETTINGS_5);
    const state = playState(writingWithDigit(round), round);
    const before = structuredClone({ ...state, writing: null });

    const after = playStateAfterResize(state, SMALLER_AREA);

    expect(after.round).toEqual(before.round);
    expect(after.settings).toEqual(before.settings);
    expect(after.progress).toEqual(before.progress);
    expect(after.counting).toEqual(before.counting);
    expect(after.settingsSession).toEqual(before.settingsSession);
    expect(after.guide).toEqual(before.guide);
    expect(isHintVisible(after.round)).toBe(true);
  });

  it('přepočet rozložení nezmění stav, který dostal (je to čistá funkce)', () => {
    const round = roundWithHint(SETTINGS_10);
    const state = playState(twoBoxesMidWriting(round), round);
    const copy = structuredClone({ ...state, writing: null });
    const tensBefore = isTwoBox(state.writing) ? boxStrokes(state.writing, 'tens') : [];

    playStateAfterResize(state, SMALLER_AREA);

    expect({ ...state, writing: null }).toEqual(copy);
    expect(isTwoBox(state.writing) ? boxStrokes(state.writing, 'tens') : []).toEqual(tensBefore);
  });

  it('stejný stav a stejná plocha dají pokaždé stejný výsledek', () => {
    const round = roundWithHint(SETTINGS_5);
    const state = playState(writingWithDigit(round), round);

    const first = playStateAfterResize(state, SMALLER_AREA);
    const second = playStateAfterResize(state, SMALLER_AREA);

    expect({ ...first, writing: null }).toEqual({ ...second, writing: null });
    expect(writtenStrokes(first.writing as WritingRound)).toEqual(
      writtenStrokes(second.writing as WritingRound),
    );
  });

  it('rozepsané tahy v okénku se smažou a okénko je prázdné', () => {
    const round = roundWithHint(SETTINGS_5);
    let writing = createWritingRound(round, { width: 320, height: 320 }, alwaysSeven);
    writing = startStroke(writing, 0);
    writing = finishStroke(writing, STROKE, 100);
    writing = startStroke(writing, 200);

    const after = playStateAfterResize(playState(writing, round), SMALLER_AREA).writing;

    expect(after).not.toBeNull();
    const single = after as WritingRound;
    expect(writtenStrokes(single)).toEqual([]);
    expect(fadingStrokes(single)).toEqual([]);
    expect(shownDigit(single)).toBeNull();
    // Rozepsaný zápis se už nerozpozná ani po čase.
    expect(shownDigit(updateWriting(single, 200 + 10 * RECOGNITION_DELAY_MS))).toBeNull();
  });

  it('rozpoznanou číslici už nejde potvrdit, takže se nezapočítá žádná odpověď', () => {
    const round = roundWithHint(SETTINGS_5);
    const writing = writingWithDigit(round);
    expect(canConfirm(writing)).toBe(true);

    const after = playStateAfterResize(playState(writing, round), SMALLER_AREA);
    const single = after.writing as WritingRound;
    const confirmed = confirmWriting(single);

    expect(canConfirm(single)).toBe(false);
    expect(confirmed.outcome).toBe('ignored');
    expect(confirmed.round.answer.solved).toBe(false);
    expect(after.round.solved).toBe(false);
  });

  it('smazání tahů při přepočtu se nepočítá jako chyba', () => {
    const round = roundWithHint(SETTINGS_5);
    const after = playStateAfterResize(playState(writingWithDigit(round), round), SMALLER_AREA);

    expect(after.round.wrongAnswers).toBe(round.wrongAnswers);
    expect((after.writing as WritingRound).answer.wrongAnswers).toBe(round.wrongAnswers);
  });

  it('obě okénka u rozsahu 10 jsou po přepočtu prázdná, bez prstu a bez číslice', () => {
    const round = roundWithHint(SETTINGS_10);
    const boxes = twoBoxesMidWriting(round);
    expect(boxDigit(boxes, 'tens')).toBe(7);

    const after = playStateAfterResize(playState(boxes, round), SMALLER_AREA).writing;

    expect(isTwoBox(after)).toBe(true);
    const two = after as TwoBoxRound;
    expect(two.activeBox).toBeNull();
    for (const which of ['tens', 'ones'] as const) {
      expect(boxStrokes(two, which)).toEqual([]);
      expect(boxDigit(two, which)).toBeNull();
    }
    expect(canConfirmBoxes(two)).toBe(false);
    expect(confirmBoxes(two).outcome).toBe('ignored');
    expect(two.answer).toEqual(round);
  });

  it('okénko po přepočtu rozpoznává tahy podle své nové velikosti', () => {
    const round = roundWithHint(SETTINGS_5);
    const after = playStateAfterResize(playState(writingWithDigit(round), round), SMALLER_AREA);

    expect((after.writing as WritingRound).area).toEqual(SMALLER_AREA);
  });

  it('bez psaní (číselník) zůstane číselník a nic se nepřidá', () => {
    const round = roundWithHint(SETTINGS_10);
    const after = playStateAfterResize(playState(null, round), SMALLER_AREA);

    expect(after.writing).toBeNull();
    expect(after.round).toEqual(round);
  });
});

describe('AC7: nové rozložení stejného kola', () => {
  /** Telefon na šířku: bez lišty, s lištou a znovu bez lišty. */
  const withoutBar = PHONE_WINDOWS[3] ?? PHONE_WINDOWS[0];
  const withBar = {
    name: 's lištou',
    width: 932,
    height: 380,
    safeArea: withoutBar?.safeArea ?? NO_NOTCH,
  };

  function problemWithMostDots(): Problem {
    return { first: 5, second: 5, operation: 'plus', result: 10 };
  }

  it('po schování a ukázání lišty je rozložení stejné jako předtím', () => {
    if (!withoutBar) {
      throw new Error('chybí zkušební okno');
    }
    const before = layoutPhoneScreen(gameAreaFor(viewportOf(withoutBar)), 11, 7);
    layoutPhoneScreen(gameAreaFor(viewportOf(withBar)), 11, 7);
    const after = layoutPhoneScreen(gameAreaFor(viewportOf(withoutBar)), 11, 7);

    expect(after).toEqual(before);
  });

  it('nápověda po přepočtu má stejné tečky ve stejném pořadí, spočítané tečky zůstanou na místě', () => {
    if (!withoutBar) {
      throw new Error('chybí zkušební okno');
    }
    const groups = hintDotGroups(problemWithMostDots());
    const big = layoutPhoneHint(
      layoutPhoneWritingScreen(gameAreaFor(viewportOf(withoutBar)), 10, 7),
      groups,
    );
    const small = layoutPhoneHint(
      layoutPhoneWritingScreen(gameAreaFor(viewportOf(withBar)), 10, 7),
      groups,
    );

    expect(small).toHaveLength(big.length);
    expect(small.map((dot) => dot.group)).toEqual(big.map((dot) => dot.group));
  });

  it('po přepočtu je vidět stejný počet hvězdiček', () => {
    if (!withoutBar) {
      throw new Error('chybí zkušební okno');
    }
    for (const window of [withoutBar, withBar]) {
      expect(layoutPhoneScreen(gameAreaFor(viewportOf(window)), 11, 7).stars).toHaveLength(7);
    }
  });
});
