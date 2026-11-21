import { describe, expect, it } from 'vitest';

import { MASCOT_FRAME_SIZE, placeMascot } from '../../src/shared/logic/mascot';
import type { MascotArea } from '../../src/shared/logic/mascot';

/**
 * Testy k #166 AC5: panda se vejde do obdélníku, který jí hra dá, se
 * zachovaným poměrem stran snímku (363 × 360 px) a s nohama dole uprostřed.
 * Pravidla v cyklu přes obdélníky různých tvarů.
 */

const AREAS: readonly [string, MascotArea][] = [
  ['čtverec', { x: 0, y: 0, width: 300, height: 300 }],
  ['široký pruh', { x: 40, y: 100, width: 900, height: 200 }],
  ['úzký vysoký pruh', { x: 700, y: 20, width: 120, height: 600 }],
  ['přesně snímek', { x: 10, y: 10, width: 363, height: 360 }],
  ['malý roh telefonu', { x: 300.5, y: 12.25, width: 64, height: 80 }],
  ['velký iPad', { x: 0, y: 0, width: 1180, height: 820 }],
];

const RATIO = MASCOT_FRAME_SIZE.width / MASCOT_FRAME_SIZE.height;

describe('#166 AC5: umístění pandy do obdélníku', () => {
  it('panda se vejde do obdélníku', () => {
    for (const [name, area] of AREAS) {
      const placed = placeMascot(area);
      expect(placed.width, `${name}: šířka`).toBeLessThanOrEqual(area.width + 1e-9);
      expect(placed.height, `${name}: výška`).toBeLessThanOrEqual(area.height + 1e-9);
      expect(placed.x - placed.width / 2, `${name}: vlevo`).toBeGreaterThanOrEqual(area.x - 1e-9);
      expect(placed.x + placed.width / 2, `${name}: vpravo`).toBeLessThanOrEqual(
        area.x + area.width + 1e-9,
      );
      expect(placed.y - placed.height, `${name}: nahoře`).toBeGreaterThanOrEqual(area.y - 1e-9);
    }
  });

  it('poměr stran pandy zůstává jako u snímku', () => {
    for (const [name, area] of AREAS) {
      const placed = placeMascot(area);
      expect(placed.width / placed.height, name).toBeCloseTo(RATIO, 9);
      expect(placed.width, name).toBeCloseTo(MASCOT_FRAME_SIZE.width * placed.scale, 9);
    }
  });

  it('panda je co největší: dotkne se aspoň dvou protilehlých okrajů', () => {
    for (const [name, area] of AREAS) {
      const placed = placeMascot(area);
      const fillsWidth = Math.abs(placed.width - area.width) < 1e-9;
      const fillsHeight = Math.abs(placed.height - area.height) < 1e-9;
      expect(fillsWidth || fillsHeight, name).toBe(true);
    }
  });

  it('nohy pandy stojí dole uprostřed obdélníku', () => {
    for (const [name, area] of AREAS) {
      const placed = placeMascot(area);
      expect(placed.x, `${name}: uprostřed`).toBeCloseTo(area.x + area.width / 2, 9);
      expect(placed.y, `${name}: dole`).toBeCloseTo(area.y + area.height, 9);
    }
  });

  it('prázdný nebo neplatný obdélník pandu schová (velikost 0), bez výjimky', () => {
    const cases: readonly [string, MascotArea][] = [
      ['nulová šířka', { x: 0, y: 0, width: 0, height: 100 }],
      ['záporná výška', { x: 0, y: 0, width: 100, height: -5 }],
      ['neplatné číslo', { x: 0, y: 0, width: Number.NaN, height: 100 }],
    ];
    for (const [name, area] of cases) {
      const placed = placeMascot(area);
      expect(placed.scale, name).toBe(0);
      expect(placed.width, name).toBe(0);
      expect(placed.height, name).toBe(0);
    }
  });
});
