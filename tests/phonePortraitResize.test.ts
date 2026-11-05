import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import type { Stroke, WritingAreaSize } from '../src/logic/digitRecognition';
import {
  gameAreaFor,
  layoutPhoneHint,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
  layoutPhoneWritingScreen,
  playStateAfterResize,
} from '../src/logic/deviceLayout';
import type { PlayState } from '../src/logic/deviceLayout';
import { countDot, startDotCounting } from '../src/logic/dotCounting';
import type { Problem } from '../src/logic/problems';
import type { GameSettings } from '../src/logic/settings';
import { CLOSED_SETTINGS, openSettings } from '../src/logic/settingsSession';
import { next, startGuide } from '../src/logic/setupGuide';
import {
  boxStrokes,
  createTwoBoxRound,
  finishBoxStroke,
  startBoxStroke,
} from '../src/logic/twoBoxWriting';
import type { TwoBoxRound } from '../src/logic/twoBoxWriting';
import {
  createWritingRound,
  finishStroke,
  startStroke,
  writtenStrokes,
} from '../src/logic/writingRound';
import type { WritingRound } from '../src/logic/writingRound';
import { seededRandom } from './seededRandom';
import { IPHONE_PORTRAIT_NOTCH, NO_NOTCH, viewportOf } from './viewportFixtures';
import type { TestWindow } from './viewportFixtures';

/**
 * Testy k #56, AC7 (otočení mezi výškou a šířkou a změna lišty prohlížeče
 * na telefonu na výšku). Navazuje na #54 (`resizeKeepsRound.test.ts`):
 * po přepočtu rozložení zůstane příklad, chyby, nápověda i se spočítanými
 * tečkami, hvězdičky, postavička, otevřené nastavení i průvodce; žádná
 * odpověď se nezapočítá a rozepsané tahy se smažou bez chyby. Že scéna
 * přepočet při otočení opravdu spustí, se kontroluje ručně v náhledu.
 */

const SETTINGS_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

const PORTRAIT: TestWindow = {
  name: '390×844 iPhone na výšku',
  width: 390,
  height: 844,
  safeArea: IPHONE_PORTRAIT_NOTCH,
};

const PORTRAIT_WITH_BAR: TestWindow = {
  name: '390×664 iPhone na výšku s lištou',
  width: 390,
  height: 664,
  safeArea: NO_NOTCH,
};

const LANDSCAPE: TestWindow = {
  name: '844×390 iPhone na šířku',
  width: 844,
  height: 390,
  safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
};

const STROKE: Stroke = [
  { x: 10, y: 10 },
  { x: 40, y: 60 },
  { x: 80, y: 120 },
];

const alwaysSeven = (): number => 7;

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

/** Kolo po dvou chybách: nápověda je vidět. */
function roundWithHint(): AnswerRound {
  const round = createAnswerRound(SETTINGS_10, seededRandom());
  const wrong = round.problem.result === 0 ? 1 : 0;
  return tapAnswer(tapAnswer(round, wrong).round, wrong).round;
}

/** Velikost okénka na psaní do 10 v rozložení na výšku (herní jednotky). */
function portraitBoxSize(window: TestWindow): WritingAreaSize {
  const layout = layoutPhonePortraitWritingScreen(gameAreaFor(viewportOf(window)), SETTINGS_10, 7);
  const first = layout.writingAreas[0];
  return { width: first?.width ?? 0, height: first?.height ?? 0 };
}

/** Velikost okénka na psaní do 10 na šířku (herní jednotky). */
function landscapeBoxSize(): WritingAreaSize {
  const layout = layoutPhoneWritingScreen(gameAreaFor(viewportOf(LANDSCAPE)), 10, 7);
  const first = layout.writingAreas[0];
  return { width: first?.width ?? 0, height: first?.height ?? 0 };
}

/** Rozehraná hra na šířku: dvě okénka, v desítkách dopsaný tah, v jednotkách prst na ploše. */
function landscapePlayState(round: AnswerRound): PlayState {
  let boxes: TwoBoxRound = createTwoBoxRound(round, landscapeBoxSize(), alwaysSeven);
  boxes = startBoxStroke(boxes, 'tens', 0);
  boxes = finishBoxStroke(boxes, STROKE, 100);
  boxes = startBoxStroke(boxes, 'ones', 200);
  return {
    round,
    settings: SETTINGS_10,
    progress: { earned: 7, character: 'plaminek' },
    counting: countDot(round, startDotCounting(round.problem), 0).counting,
    writing: boxes,
    settingsSession: openSettings(CLOSED_SETTINGS, SETTINGS_10),
    guide: next(startGuide(), 0),
  };
}

describe('AC7: otočení telefonu na výšku zachová rozehrané kolo', () => {
  it('po otočení ze šířky na výšku zůstane příklad, chyby, nápověda, spočítané tečky, hvězdičky, postavička, nastavení i průvodce', () => {
    const round = roundWithHint();
    const state = landscapePlayState(round);
    const before = structuredClone({ ...state, writing: null });

    const after = playStateAfterResize(state, portraitBoxSize(PORTRAIT));

    expect({ ...after, writing: null }).toEqual(before);
    expect(isHintVisible(after.round)).toBe(true);
    expect(after.round.solved).toBe(false);
  });

  it('rozepsané tahy se po otočení smažou, nepočítá se to jako chyba a okénka mají novou vysokou velikost', () => {
    const round = roundWithHint();
    const tallBox = portraitBoxSize(PORTRAIT);

    const after = playStateAfterResize(landscapePlayState(round), tallBox).writing as TwoBoxRound;

    expect(boxStrokes(after, 'tens')).toEqual([]);
    expect(boxStrokes(after, 'ones')).toEqual([]);
    expect(after.activeBox).toBeNull();
    expect(after.answer.wrongAnswers).toBe(round.wrongAnswers);
    expect(after.tens.area).toEqual(tallBox);
    expect(after.ones.area).toEqual(tallBox);
  });

  it('po ukázání lišty na výšku se okénko vyprázdní a dostane velikost z nového rozložení', () => {
    const round = createAnswerRound({ ...SETTINGS_10, maxNumber: 5 }, seededRandom());
    let writing: WritingRound = createWritingRound(round, portraitBoxSize(PORTRAIT), alwaysSeven);
    writing = startStroke(writing, 0);
    writing = finishStroke(writing, STROKE, 100);
    const state: PlayState = { ...landscapePlayState(round), writing };
    const smaller = portraitBoxSize(PORTRAIT_WITH_BAR);

    const after = playStateAfterResize(state, smaller).writing as WritingRound;

    expect(writtenStrokes(after)).toEqual([]);
    expect(after.area).toEqual(smaller);
    expect(after.answer.wrongAnswers).toBe(round.wrongAnswers);
  });
});

describe('AC7: rozložení na výšku po otočení a změně lišty', () => {
  it('po otočení na šířku a zpět je rozložení na výšku stejné jako předtím', () => {
    const settings = { maxNumber: 10 as const, operations: 'plus' as const };
    const before = layoutPhonePortraitScreen(gameAreaFor(viewportOf(PORTRAIT)), settings, 7);
    gameAreaFor(viewportOf(LANDSCAPE));
    const after = layoutPhonePortraitScreen(gameAreaFor(viewportOf(PORTRAIT)), settings, 7);

    expect(after).toEqual(before);
  });

  it('po ukázání a schování lišty je rozložení na výšku stejné jako předtím', () => {
    const settings = { maxNumber: 20 as const, operations: 'mixed' as const };
    const before = layoutPhonePortraitWritingScreen(gameAreaFor(viewportOf(PORTRAIT)), settings, 4);
    layoutPhonePortraitWritingScreen(gameAreaFor(viewportOf(PORTRAIT_WITH_BAR)), settings, 4);
    const after = layoutPhonePortraitWritingScreen(gameAreaFor(viewportOf(PORTRAIT)), settings, 4);

    expect(after).toEqual(before);
  });

  it('po otočení má nápověda stejné tečky ve stejném pořadí, spočítané tečky zůstanou', () => {
    const groups = hintDotGroups(plus(6, 4));
    const landscape = layoutPhoneHint(
      layoutPhoneWritingScreen(gameAreaFor(viewportOf(LANDSCAPE)), 10, 7, groups),
      groups,
    );
    const portrait = layoutPhonePortraitHint(
      layoutPhonePortraitWritingScreen(gameAreaFor(viewportOf(PORTRAIT)), SETTINGS_10, 7),
      groups,
    );

    expect(portrait).toHaveLength(landscape.length);
    expect(portrait.map((dot) => dot.group)).toEqual(landscape.map((dot) => dot.group));
  });

  it('po otočení je vidět stejný počet hvězdiček', () => {
    const settings = { maxNumber: 10 as const, operations: 'plus' as const };
    for (const window of [PORTRAIT, PORTRAIT_WITH_BAR]) {
      const layout = layoutPhonePortraitScreen(gameAreaFor(viewportOf(window)), settings, 7);
      expect(layout.stars, window.name).toHaveLength(7);
    }
  });
});
