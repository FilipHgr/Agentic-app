import { describe, expect, it } from 'vitest';

import { layoutSettingsPanel } from '../../../src/games/counting/logic/settingsLayout';
import { layoutGuideStep } from '../../../src/games/counting/logic/setupGuide';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';

/**
 * Testy k #51 AC1: místo reproduktoru ve spodním pásu průvodce na herní
 * ploše 1024 × 768. Ostatní rozložení z #49 se nemění (to hlídá
 * `setupGuideLayout.test.ts`). Barvy reproduktoru hlídá
 * `lightSettingsTheme.test.ts` (#53), krátké zvětšení při ťuknutí
 * a pulzování se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MIN_TOUCH_SIZE = 64;
const STEPS: readonly GuideStep[] = [1, 2, 3, 4];

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function centeredBox(slot: CenteredSlot): Box {
  return {
    left: slot.x - slot.width / 2,
    right: slot.x + slot.width / 2,
    top: slot.y - slot.height / 2,
    bottom: slot.y + slot.height / 2,
  };
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

function speakerBox(step: GuideStep): Box {
  return centeredBox(layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT).speaker);
}

/** Všechny ostatní prvky kroku: text, tlačítka, ukazatel a řady nastavení. */
function otherBoxes(step: GuideStep): Box[] {
  const layout = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
  const panel = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
  const own = [layout.message, layout.back, layout.indicator, layout.right].filter(
    (slot) => slot !== null,
  );
  const rows = panel.rows.flatMap((row) => [row.label, ...row.options]);
  return [...own, ...rows].map(centeredBox);
}

describe('AC1: reproduktor na každém kroku', () => {
  for (const step of STEPS) {
    it(`na kroku ${step} je reproduktor ve spodním pásu v x 322–394, y 680–752`, () => {
      expect(speakerBox(step)).toEqual({ left: 322, right: 394, top: 680, bottom: 752 });
    });

    it(`na kroku ${step} má reproduktor 72 × 72 px, tedy aspoň 64 × 64 px pro prst`, () => {
      const box = speakerBox(step);
      expect(box.right - box.left).toBe(72);
      expect(box.bottom - box.top).toBe(72);
      expect(box.right - box.left).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
      expect(box.bottom - box.top).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    });

    it(`na kroku ${step} je mezi reproduktorem a ukazatelem kroku 58 px`, () => {
      const { indicator } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      expect(centeredBox(indicator).left - speakerBox(step).right).toBe(58);
    });

    it(`na kroku ${step} reproduktor nepřekrývá žádný jiný prvek průvodce`, () => {
      const speaker = speakerBox(step);
      for (const box of otherBoxes(step)) {
        expect(overlaps(speaker, box), JSON.stringify(box)).toBe(false);
      }
    });

    it(`na kroku ${step} je reproduktor celý uvnitř plochy 1024 × 768`, () => {
      const box = speakerBox(step);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(box.bottom).toBeLessThanOrEqual(SCREEN_HEIGHT);
    });
  }

  for (const step of [2, 3, 4] as const) {
    it(`na kroku ${step} je mezi „Zpět“ a reproduktorem 58 px`, () => {
      const { back } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (back === null) throw new Error(`na kroku ${step} chybí „Zpět“`);
      expect(centeredBox(back).right).toBe(264);
      expect(speakerBox(step).left - centeredBox(back).right).toBe(58);
    });
  }

  it('na kroku 1, kde „Zpět“ chybí, je reproduktor na stejném místě jako na kroku 2', () => {
    const step1 = layoutGuideStep(1, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(step1.back).toBeNull();
    expect(step1.speaker).toEqual(layoutGuideStep(2, SCREEN_WIDTH, SCREEN_HEIGHT).speaker);
  });

  it('vodorovně se pás skládá 24 + 240 + 58 + 72 + 58 + 120 + 188 + 240 + 24 = 1024', () => {
    const layout = layoutGuideStep(3, SCREEN_WIDTH, SCREEN_HEIGHT);
    if (layout.back === null) throw new Error('na kroku 3 chybí „Zpět“');
    const back = centeredBox(layout.back);
    const speaker = centeredBox(layout.speaker);
    const indicator = centeredBox(layout.indicator);
    const right = centeredBox(layout.right);
    expect(back.left).toBe(24);
    expect(back.right - back.left).toBe(240);
    expect(speaker.left - back.right).toBe(58);
    expect(speaker.right - speaker.left).toBe(72);
    expect(indicator.left - speaker.right).toBe(58);
    expect(indicator.right - indicator.left).toBe(120);
    expect(right.left - indicator.right).toBe(188);
    expect(right.right - right.left).toBe(240);
    expect(SCREEN_WIDTH - right.right).toBe(24);
  });

  it('reproduktor má stejnou výšku a svislou polohu jako tlačítka Zpět a Další', () => {
    const layout = layoutGuideStep(2, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(layout.speaker.y).toBe(layout.right.y);
    expect(layout.speaker.height).toBe(layout.right.height);
  });
});
