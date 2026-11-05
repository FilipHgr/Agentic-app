import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import {
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { slotWidth } from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import {
  IPAD_WINDOWS,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  box,
  freeAreaOf,
  overlaps,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #68 (domeček ve hře), AC1 a AC4: nic ze hry neleží v rohu
 * domečku vlevo nahoře. Prochází telefon na šířku (#54) a na výšku (#56)
 * ve všech rozsazích, s číselníkem i s psaním, s prázdnou i plnou řadou
 * hvězdiček (oslava), bez nápovědy i se vzorkem nápověd. Příklad se měří
 * místem pro nejdelší příklad v rozsahu (`problemSize`).
 *
 * Roh domečku je zrcadlově stejný jako roh kolečka v daném rozložení:
 * - na šířku volný roh 88 × 88 px u levého horního okraje volné plochy
 *   (jako `gearCornerOf` vpravo, #54),
 * - na výšku plocha pro prst domečku a 4 px kolem ní (jako u kolečka
 *   v `phonePortraitLayout.test.ts`, #56).
 *
 * Na iPadu (AC1, AC6) domeček neleží na žádném prvku herní plochy; že se
 * herní plocha iPadu nezměnila, hlídá snapshot v `tabletLayoutUnchanged.test.ts`.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];
const STAR_COUNTS = [0, STARS_PER_SET];

/** Strana volného rohu na šířku, stejná jako u kolečka (#54). */
const LANDSCAPE_CORNER_SIZE = 88;
/** Odstup od plochy domečku na výšku, stejný jako u kolečka (#56). */
const PORTRAIT_CORNER_GAP = 4;

type Layout = DeviceScreenLayout | DeviceWritingLayout;

interface Element {
  readonly name: string;
  readonly css: Box;
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Okrajové a typické nápovědy: nejmenší, jedna velká skupinka, dvě skupinky, nejvíc teček. */
function sampleHintProblems(maxNumber: MaxNumber): Problem[] {
  const half = Math.floor(maxNumber / 2);
  return [
    plus(1, 0),
    plus(0, maxNumber),
    plus(maxNumber, 0),
    minus(maxNumber, maxNumber),
    plus(1, 1),
    plus(half, maxNumber - half),
    plus(maxNumber - 1, 1),
  ];
}

function isWriting(layout: Layout): layout is DeviceWritingLayout {
  return 'writingAreas' in layout;
}

function layoutFor(
  area: GameArea,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount: number,
  hintGroups: readonly number[],
): Layout {
  return mode === 'číselník'
    ? layoutDeviceScreen(area, maxNumber + 1, starCount, hintGroups, 'mixed')
    : layoutDeviceWritingScreen(area, maxNumber, starCount, hintGroups, 'mixed');
}

/** Všechno, co hra na obrazovku nakreslí, v CSS px okna; s tečkami nápovědy, když jsou. */
function gameElements(area: GameArea, layout: Layout, hintGroups: readonly number[]): Element[] {
  const css = (b: Box): Box => toCss(b, area);
  const elements: Element[] = [
    ...layout.stars.map((star, index) => ({
      name: `hvězdička ${index + 1}`,
      css: css(box(star.x, star.y, layout.starSize, layout.starSize)),
    })),
    {
      name: 'příklad',
      css: css(
        box(
          layout.problem.x,
          layout.problem.y,
          layout.problemSize.width,
          layout.problemSize.height,
        ),
      ),
    },
  ];
  if (isWriting(layout)) {
    layout.writingAreas.forEach((slot, index) =>
      elements.push({
        name: `okénko ${index + 1}`,
        css: css(box(slot.x, slot.y, slot.width, slot.height)),
      }),
    );
    for (const [name, slot] of [
      ['smazání', layout.clearButton],
      ['✓', layout.confirmButton],
    ] as const) {
      elements.push({ name, css: css(box(slot.x, slot.y, slot.size, slot.size)) });
    }
  } else {
    // Číselník na šířku má od návrhu C široká tlačítka (`width`).
    layout.answerButtons.forEach((slot, index) =>
      elements.push({
        name: `tlačítko ${index}`,
        css: css(box(slot.x, slot.y, slotWidth(slot), slot.size)),
      }),
    );
  }
  if (hintGroups.length > 0) {
    const dotSize = layout.hintDotsCountable ? layout.hintDotHitSize : layout.hintStyle.dotSize;
    layoutDeviceHint(layout, hintGroups).forEach((dot, index) =>
      elements.push({ name: `tečka ${index + 1}`, css: css(box(dot.x, dot.y, dotSize, dotSize)) }),
    );
  }
  return elements;
}

/** Plocha pro prst u domečku v CSS px okna. */
function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

/** Roh domečku na šířku: 88 × 88 px vlevo nahoře ve volné ploše. */
function landscapeHomeCornerOf(window: TestWindow): Box {
  const free = freeAreaOf(window);
  return {
    left: free.left,
    right: free.left + LANDSCAPE_CORNER_SIZE,
    top: free.top,
    bottom: free.top + LANDSCAPE_CORNER_SIZE,
  };
}

/** Roh domečku na výšku: plocha pro prst a 4 px kolem ní. */
function portraitHomeCornerOf(window: TestWindow): Box {
  const hit = homeHitOf(window);
  return {
    left: hit.left - PORTRAIT_CORNER_GAP,
    right: hit.right + PORTRAIT_CORNER_GAP,
    top: hit.top - PORTRAIT_CORNER_GAP,
    bottom: hit.bottom + PORTRAIT_CORNER_GAP,
  };
}

type Case = [string, MaxNumber, Mode, number, TestWindow];

function casesFor(windows: readonly TestWindow[]): Case[] {
  return windows.flatMap((window) =>
    RANGES.flatMap((maxNumber) =>
      MODES.flatMap((mode) =>
        STAR_COUNTS.map((stars): Case => [window.name, maxNumber, mode, stars, window]),
      ),
    ),
  );
}

function expectCornerEmpty(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount: number,
  corner: Box,
): void {
  const area = gameAreaFor(viewportOf(window));
  const where = `${window.name}, rozsah ${maxNumber}, ${mode}, ${starCount} hvězdiček`;
  const screens: Array<{ label: string; groups: readonly number[] }> = [
    { label: 'bez nápovědy', groups: [] },
    ...sampleHintProblems(maxNumber).map((problem) => ({
      label: `nápověda ${problem.first} ${problem.operation === 'plus' ? '+' : '−'} ${problem.second}`,
      groups: hintDotGroups(problem),
    })),
  ];
  for (const screen of screens) {
    const layout = layoutFor(area, maxNumber, mode, starCount, screen.groups);
    for (const element of gameElements(area, layout, screen.groups)) {
      expect(overlaps(element.css, corner), `${where}, ${screen.label}, ${element.name}`).toBe(
        false,
      );
    }
  }
}

describe('AC4: na telefonu na šířku nic ze hry neleží v rohu domečku', () => {
  it.each(casesFor(PHONE_WINDOWS))(
    '%s, rozsah %i (%s), %i hvězdiček: levý horní roh 88 × 88 px zůstane prázdný, i s nápovědou',
    (_, maxNumber, mode, starCount, window) => {
      expectCornerEmpty(window, maxNumber, mode, starCount, landscapeHomeCornerOf(window));
    },
  );

  it.each(PHONE_WINDOWS)('$name: plocha domečku je celá v rohu domečku', (window) => {
    const hit = homeHitOf(window);
    const corner = landscapeHomeCornerOf(window);

    expect(hit.left).toBeGreaterThanOrEqual(corner.left);
    expect(hit.right).toBeLessThanOrEqual(corner.right);
    expect(hit.bottom).toBeLessThanOrEqual(corner.bottom);
  });
});

describe('AC4: na telefonu na výšku nic ze hry neleží u domečku', () => {
  it.each(casesFor([...PHONE_PORTRAIT_WINDOWS, ...PHONE_PORTRAIT_EDGE_WINDOWS]))(
    '%s, rozsah %i (%s), %i hvězdiček: nic není na ploše domečku ani blíž než 4 px, i s nápovědou',
    (_, maxNumber, mode, starCount, window) => {
      expectCornerEmpty(window, maxNumber, mode, starCount, portraitHomeCornerOf(window));
    },
  );
});

describe('AC1: na iPadu je domeček mimo herní prvky', () => {
  it.each(
    IPAD_WINDOWS.flatMap((window) =>
      RANGES.flatMap((maxNumber) =>
        MODES.map((mode): [string, MaxNumber, Mode, TestWindow] => [
          window.name,
          maxNumber,
          mode,
          window,
        ]),
      ),
    ),
  )(
    '%s, rozsah %i (%s): domeček nepřekrývá hvězdičky, příklad, nápovědu ani ovládání',
    (_, maxNumber, mode, window) => {
      expectCornerEmpty(window, maxNumber, mode, STARS_PER_SET, homeHitOf(window));
    },
  );
});
