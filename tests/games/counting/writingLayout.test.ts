import { describe, expect, it } from 'vitest';

import { layoutWritingScreen, writingAreaAt } from '../../../src/games/counting/logic/screenLayout';
import type {
  WritingAreaSlot,
  WritingLayout,
} from '../../../src/games/counting/logic/screenLayout';
import { writingBoxCount } from '../../../src/games/counting/logic/settings';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';

/**
 * Testy rozložení při psaní (#41 a #42, AC7, jen to, co jde ověřit v logice
 * rozložení): při rozsahu 5 jedno okénko 320 × 320 px, při 10 a 20 dvě
 * okénka vedle sebe aspoň 280 × 280 px s mezerou aspoň 24 px, ✓ a smazání
 * aspoň 64 × 64 px, vše na obrazovce 1024 × 768 a nic se nepřekrývá (to od
 * #81 hlídají společná pravidla).
 * Zřetelné oddělení okének, plynulost a telefon se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const SINGLE_BOX_SIDE = 320;
const MIN_BOX_SIDE = 280;
const MIN_BOX_GAP = 24;

/** Rozsahy se dvěma okénky (desítky a jednotky). */
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function areaBox(area: WritingAreaSlot): Box {
  return box(area.x, area.y, area.width, area.height);
}

function layoutFor(maxNumber: MaxNumber): WritingLayout {
  return layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
}

/** Okénko desítek a jednotek (jen u rozsahu 10 a 20). */
function tensAndOnes(layout: WritingLayout): [WritingAreaSlot, WritingAreaSlot] {
  const [tens, ones] = layout.writingAreas;
  expect(tens).toBeDefined();
  expect(ones).toBeDefined();
  if (!tens || !ones) {
    throw new Error('Rozložení nemá dvě okénka');
  }
  return [tens, ones];
}

describe('AC1: při rozsahu 10 a 20 jsou dvě okénka, při rozsahu 5 jedno', () => {
  it('při rozsahu 5 je jedno okénko jako dřív', () => {
    expect(writingBoxCount(5)).toBe(1);
    expect(layoutFor(5).writingAreas).toHaveLength(1);
  });

  it('při rozsahu 10 a 20 jsou dvě okénka vedle sebe, vlevo desítky a vpravo jednotky', () => {
    for (const max of TWO_BOX_RANGES) {
      const where = `rozsah ${max}`;
      expect(writingBoxCount(max), where).toBe(2);
      expect(layoutFor(max).writingAreas, where).toHaveLength(2);
      const [tens, ones] = tensAndOnes(layoutFor(max));

      expect(areaBox(tens).right, where).toBeLessThanOrEqual(areaBox(ones).left);
      // Vedle sebe: obě okénka jsou ve stejné výšce.
      expect(tens.y, where).toBe(ones.y);
    }
  });
});

describe('AC2: tah patří okénku, ve kterém začal', () => {
  it('při rozsahu 10 a 20: ťuknutí do okénka najde to správné', () => {
    for (const max of TWO_BOX_RANGES) {
      const layout = layoutFor(max);
      const [tens, ones] = tensAndOnes(layout);
      const where = `rozsah ${max}`;

      expect(writingAreaAt(layout, { x: tens.x, y: tens.y }), where).toBe('tens');
      expect(writingAreaAt(layout, { x: ones.x, y: ones.y }), where).toBe('ones');
      expect(writingAreaAt(layout, { x: tens.x - tens.width / 2 + 2, y: tens.y }), where).toBe(
        'tens',
      );
      expect(writingAreaAt(layout, { x: ones.x + ones.width / 2 - 2, y: ones.y }), where).toBe(
        'ones',
      );
    }
  });

  it('při rozsahu 10 a 20: dotyk v mezeře nebo mimo okénka nezačne tah', () => {
    for (const max of TWO_BOX_RANGES) {
      const layout = layoutFor(max);
      const [tens, ones] = tensAndOnes(layout);
      const gapX = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;
      const where = `rozsah ${max}`;

      expect(writingAreaAt(layout, { x: gapX, y: tens.y }), where).toBeNull();
      expect(
        writingAreaAt(layout, { x: tens.x, y: tens.y - tens.height / 2 - 10 }),
        where,
      ).toBeNull();
      expect(writingAreaAt(layout, { x: 0, y: 0 }), where).toBeNull();
    }
  });

  it('při rozsahu 5 dotyk v okénku najde jediné okénko, mimo něj žádné', () => {
    const layout = layoutFor(5);
    const [only] = layout.writingAreas;
    expect(only).toBeDefined();

    expect(writingAreaAt(layout, { x: only?.x ?? 0, y: only?.y ?? 0 })).not.toBeNull();
    expect(writingAreaAt(layout, { x: 0, y: 0 })).toBeNull();
  });
});

// Že ✓ a smazání mají aspoň 64 × 64 px, vše je na obrazovce a nic se
// nepřekrývá, ani s nápovědou u všech příkladů, ve všech rozsazích (při
// psaní se píše ve všech, #42, AC1), hlídají od #81 společná pravidla
// v `countingLayoutRules.test.ts`.

describe('AC7: okénka jsou dost velká na dětský prst', () => {
  it('při rozsahu 5 má okénko aspoň 320 × 320 px jako v #41', () => {
    const [only] = layoutFor(5).writingAreas;

    expect(only?.width).toBeGreaterThanOrEqual(SINGLE_BOX_SIDE);
    expect(only?.height).toBeGreaterThanOrEqual(SINGLE_BOX_SIDE);
  });

  it('při rozsahu 10 a 20 má každé okénko aspoň 280 × 280 px a mezi okénky je aspoň 24 px', () => {
    for (const max of TWO_BOX_RANGES) {
      const [tens, ones] = tensAndOnes(layoutFor(max));
      const where = `rozsah ${max}`;
      for (const area of [tens, ones]) {
        expect(area.width, where).toBeGreaterThanOrEqual(MIN_BOX_SIDE);
        expect(area.height, where).toBeGreaterThanOrEqual(MIN_BOX_SIDE);
      }
      expect(areaBox(ones).left - areaBox(tens).right, where).toBeGreaterThanOrEqual(MIN_BOX_GAP);
    }
  });
});
