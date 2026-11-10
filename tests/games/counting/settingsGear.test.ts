import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type {
  PhoneScreenLayout,
  PhoneWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import type { ButtonSlot, HintDot } from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  MIN_GAP_TO_CONTROLS,
  PHONE_EDGE_OFFSET,
  PHONE_HIT_SIZE,
  TOLERANCE,
  gearOf,
  hitBoxOf,
} from '../../shared/settingsGearFixtures';
import {
  PHONE_WINDOWS,
  box,
  freeAreaOf,
  gapBetween,
  gearCornerOf,
  heightOf,
  isInside,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #55, AC2: kolečko nastavení nepřekáží ovládání Počítání na
 * telefonu na šířku. Ostatní testy kolečka jsou
 * v `tests/shared/settingsGear.test.ts`.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

// ---------------------------------------------------------------------------
// Ovládání telefonu na šířku (AC2)
// ---------------------------------------------------------------------------

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Nápovědy, které mění rozložení nejvíc: žádná, jedna tečka, plná skupinka, dvě skupinky. */
function sampleHintGroups(maxNumber: MaxNumber): number[][] {
  const half = Math.floor(maxNumber / 2);
  const problems = [
    plus(1, 0),
    plus(0, maxNumber),
    plus(maxNumber, 0),
    minus(maxNumber, maxNumber),
    plus(1, 1),
    plus(half, maxNumber - half),
    plus(5, 0),
    plus(6, 0),
    plus(5, 5),
    plus(1, maxNumber - 1),
  ].filter((problem) => problem.first + problem.second <= maxNumber);
  return [[], ...problems.map(hintDotGroups).filter((groups) => groups.length > 0)];
}

interface Control {
  readonly name: string;
  readonly css: Box;
}

function slotBox(area: GameArea, slot: ButtonSlot): Box {
  return toCss(box(slot.x, slot.y, slot.size, slot.size), area);
}

function isWriting(layout: PhoneScreenLayout | PhoneWritingLayout): layout is PhoneWritingLayout {
  return 'writingAreas' in layout;
}

/** Tlačítka, okénka na psaní a ťukací tečky nápovědy v CSS px. */
function controlsOf(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  hintGroups: readonly number[],
): Control[] {
  const area = gameAreaFor(viewportOf(window));
  const layout =
    mode === 'číselník'
      ? layoutPhoneScreen(area, maxNumber + 1, STARS_PER_SET, hintGroups)
      : layoutPhoneWritingScreen(area, maxNumber, STARS_PER_SET, hintGroups);
  const controls: Control[] = [];
  if (isWriting(layout)) {
    layout.writingAreas.forEach((writing, index) =>
      controls.push({
        name: `okénko ${index + 1}`,
        css: toCss(box(writing.x, writing.y, writing.width, writing.height), area),
      }),
    );
    controls.push({ name: 'smazání', css: slotBox(area, layout.clearButton) });
    controls.push({ name: '✓', css: slotBox(area, layout.confirmButton) });
  } else {
    layout.answerButtons.forEach((slot, index) =>
      controls.push({ name: `tlačítko ${index}`, css: slotBox(area, slot) }),
    );
  }
  if (hintGroups.length > 0 && layout.hintDotsCountable) {
    const dots: HintDot[] = layoutPhoneHint(layout, hintGroups);
    const size = layout.hintDotHitSize;
    dots.forEach((dot, index) =>
      controls.push({
        name: `tečka ${index + 1}`,
        css: toCss(box(dot.x, dot.y, size, size), area),
      }),
    );
  }
  return controls;
}

// ---------------------------------------------------------------------------

describe('AC2: na telefonu na šířku je kolečko v rohu a nepřekáží ovládání', () => {
  for (const window of PHONE_WINDOWS) {
    it(`${window.name}: plocha pro prst je 8 px od horního a pravého okraje volné plochy`, () => {
      const free = freeAreaOf(window);
      const hit = hitBoxOf(window, gearOf(window));
      expect(hit.top - free.top).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
      expect(free.right - hit.right).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
    });

    it(`${window.name}: plocha pro prst není pod výřezem a leží celá ve volném rohu`, () => {
      const hit = hitBoxOf(window, gearOf(window));
      expect(isInside(hit, freeAreaOf(window))).toBe(true);
      expect(isInside(hit, gearCornerOf(window))).toBe(true);
      expect(widthOf(hit)).toBe(PHONE_HIT_SIZE);
      expect(heightOf(hit)).toBe(PHONE_HIT_SIZE);
    });

    for (const maxNumber of RANGES) {
      for (const mode of MODES) {
        it(`${window.name}, do ${maxNumber}, ${mode}: od tlačítek, teček i okének je kolečko aspoň 8 px, s nápovědou i bez`, () => {
          const hit = hitBoxOf(window, gearOf(window));
          for (const groups of sampleHintGroups(maxNumber)) {
            for (const control of controlsOf(window, maxNumber, mode, groups)) {
              const where = `${control.name}, nápověda [${groups.join(', ')}]`;
              expect(gapBetween(hit, control.css), where).toBeGreaterThanOrEqual(
                MIN_GAP_TO_CONTROLS - TOLERANCE,
              );
            }
          }
        });
      }
    }
  }
});
