import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import {
  gameAreaFor,
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  sceneryLayoutFor,
} from '../src/logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceWritingLayout,
  GameArea,
  LayoutMode,
} from '../src/logic/deviceLayout';
import type { Problem } from '../src/logic/problems';
import type { MaxNumber, OperationMode } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  IPAD_WINDOWS,
  NO_NOTCH,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  box,
  overlaps,
  viewportOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Oprava k #54 (AC „nic se nepřekrývá“): při psaní prstem na telefonu se
 * příklad a postavička kreslí ze stejného rozložení jako okénka a tečky
 * nápovědy. Dřív je scéna na šířku brala z rozložení pro číselník, a když
 * nápověda zabrala dvě řady (např. 2 + 6 na 844×340), příklad zasahoval do
 * okének. Na iPadu a ve zmenšeném zobrazení zůstává rozložení s číselníkem.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const OPERATIONS: OperationMode = 'mixed';

/** iPad na výšku dostane zmenšené zobrazení. */
const SCALED_WINDOW: TestWindow = {
  name: '820×1180 iPad na výšku',
  width: 820,
  height: 1180,
  safeArea: NO_NOTCH,
};

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Bez nápovědy, nápověda ve dvou řadách (2 + 6) a okrajové nápovědy v rozsahu. */
function hintGroupsFor(maxNumber: MaxNumber): number[][] {
  const half = Math.floor(maxNumber / 2);
  const problems = [
    plus(1, 0),
    plus(1, 1),
    plus(2, 6),
    plus(maxNumber, 0),
    plus(0, maxNumber),
    plus(half, maxNumber - half),
    minus(maxNumber, maxNumber),
  ].filter((problem) => problem.first + problem.second <= maxNumber);
  const groups = [[], ...problems.map(hintDotGroups)];
  const unique = new Map(groups.map((group) => [group.join('+'), group]));
  return [...unique.values()];
}

interface PlayScreen {
  readonly area: GameArea;
  readonly keypad: DeviceScreenLayout;
  readonly writing: DeviceWritingLayout;
  readonly groups: readonly number[];
}

function playScreen(window: TestWindow, maxNumber: MaxNumber, groups: number[]): PlayScreen {
  const area = gameAreaFor(viewportOf(window));
  return {
    area,
    keypad: layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET, groups, OPERATIONS),
    writing: layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET, groups, OPERATIONS),
    groups,
  };
}

/** Co hráč při psaní vidí: příklad a postavička z rozložení, které vybere scéna. */
function sceneryWhileWriting(screen: PlayScreen): DeviceScreenLayout | DeviceWritingLayout {
  return sceneryLayoutFor(screen.area.mode, screen.keypad, screen.writing);
}

function problemBox(layout: DeviceScreenLayout | DeviceWritingLayout): Box {
  const { problem, problemSize } = layout;
  return box(problem.x, problem.y, problemSize.width, problemSize.height);
}

/** Postavička i se skokem nahoru a tancem do stran. */
function mascotBox(layout: DeviceScreenLayout | DeviceWritingLayout): Box {
  const { mascot, mascotSize, mascotJumpHeight, mascotDanceSway } = layout;
  return {
    left: mascot.x - mascotSize / 2 - mascotDanceSway,
    right: mascot.x + mascotSize / 2 + mascotDanceSway,
    top: mascot.y - mascotSize / 2 - mascotJumpHeight,
    bottom: mascot.y + mascotSize / 2,
  };
}

/** Okénka na psaní a tečky nápovědy, jak je scéna nakreslí. */
function writingControlsAndDots(screen: PlayScreen): Box[] {
  const { writing } = screen;
  const boxes = writing.writingAreas.map((area) => box(area.x, area.y, area.width, area.height));
  const dotSize = writing.hintStyle.dotSize;
  const dots = screen.groups.length > 0 ? layoutDeviceHint(writing, screen.groups) : [];
  return [...boxes, ...dots.map((dot) => box(dot.x, dot.y, dotSize, dotSize))];
}

function phoneCases(windows: readonly TestWindow[]): [string, TestWindow, MaxNumber, number[]][] {
  return windows.flatMap((window) =>
    RANGES.flatMap((maxNumber) =>
      hintGroupsFor(maxNumber).map((groups): [string, TestWindow, MaxNumber, number[]] => [
        `${window.name}, do ${maxNumber}, nápověda [${groups.join(', ')}]`,
        window,
        maxNumber,
        groups,
      ]),
    ),
  );
}

const PHONE_CASES = [...phoneCases(PHONE_WINDOWS), ...phoneCases(PHONE_PORTRAIT_WINDOWS)];

describe('při psaní prstem na telefonu je příklad i postavička tam, kde s nimi počítají okénka', () => {
  it.each(PHONE_CASES)(
    'příklad ani postavička nezasahují do okének ani do teček nápovědy (%s)',
    (_name, window, maxNumber, groups) => {
      const screen = playScreen(window, maxNumber, groups);
      const scenery = sceneryWhileWriting(screen);
      const others = writingControlsAndDots(screen);

      for (const other of others) {
        expect(overlaps(problemBox(scenery), other)).toBe(false);
        expect(overlaps(mascotBox(scenery), other)).toBe(false);
      }
    },
  );

  it('na telefonu na šířku s nápovědou 2 + 6 příklad nezasahuje do okének (844×340)', () => {
    const iphone = PHONE_WINDOWS.find((window) => window.width === 844);
    expect(iphone).toBeDefined();
    const screen = playScreen(iphone as TestWindow, 10, hintDotGroups(plus(2, 6)));
    const scenery = sceneryWhileWriting(screen);

    for (const area of screen.writing.writingAreas) {
      const areaBox = box(area.x, area.y, area.width, area.height);
      expect(overlaps(problemBox(scenery), areaBox)).toBe(false);
    }
  });
});

describe('na iPadu a ve zmenšeném zobrazení zůstává příklad i postavička jako dřív', () => {
  const windows = [...IPAD_WINDOWS, SCALED_WINDOW];
  const cases = windows.flatMap((window) =>
    RANGES.map((maxNumber): [string, TestWindow, MaxNumber] => [window.name, window, maxNumber]),
  );

  it.each(cases)(
    'při psaní se příklad a postavička kreslí z rozložení s číselníkem (%s, do %i)',
    (_name, window, maxNumber) => {
      const screen = playScreen(window, maxNumber, []);
      const expectedModes: LayoutMode[] = ['tablet', 'scaled'];
      expect(expectedModes).toContain(screen.area.mode);

      expect(sceneryWhileWriting(screen)).toEqual(screen.keypad);
    },
  );
});
