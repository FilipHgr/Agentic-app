import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../src/shared/logic/viewportLayout';
import { settingsGearFor } from '../../src/shared/logic/settingsGear';
import type { Viewport } from '../../src/shared/logic/viewportLayout';
import type { SettingsGear } from '../../src/shared/logic/settingsGear';
import {
  IPHONE_PORTRAIT_NOTCH,
  IPHONE_SE_LANDSCAPE,
  MIN_RING_STROKE,
  PHONE_EDGE_OFFSET,
  PHONE_GEAR_SIZE,
  PHONE_HIT_SIZE,
  PHONE_PORTRAIT_WINDOWS,
  TABLET_EDGE_OFFSET,
  TABLET_GEAR_SIZE,
  TABLET_GEAR_WINDOWS,
  TOLERANCE,
  gameBoxOf,
  gearBoxOf,
  gearOf,
  hitBoxOf,
  windowOf,
} from './settingsGearFixtures';
import {
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_WINDOWS,
  freeAreaOf,
  isInside,
  overlaps,
  viewportOf,
} from './viewportFixtures';

/**
 * Testy k #55: menší kolečko nastavení na telefonu. Kolečko je mimo herní
 * plochu (prvek stránky), `settingsGearFor` vrací jeho velikost, plochu
 * pro prst, odsazení plochy pro prst od horního a pravého okraje okna
 * (už i s výřezem) a kroužek, který se při podržení plní. Vše v CSS px.
 *
 * Platí doporučení z issue a od story-reviewer: odsazení 8 px se měří
 * k ploše pro prst, volný roh zůstává 88 px, okno 667×320 (iPhone SE)
 * dostane malé kolečko, úzký iPad (Split View) také, kroužek obepíná
 * 48px kolečko a jeho čára má aspoň 3 px.
 *
 * AC6 (podržení 1 s, během průvodce nefunguje) hlídají existující testy:
 * tests/shared/settings.test.ts („AC1: nastavení se otevře až po podržení
 * kolečka“) a tests/games/counting/setupGuide.test.ts (`canOpenSettingsByHold`).
 */

describe('AC1: na telefonu je kolečko malé, ale dobře se drží', () => {
  for (const window of [...PHONE_WINDOWS, IPHONE_SE_LANDSCAPE]) {
    it(`${window.name}: kolečko má 48 × 48 px a plocha pro prst 64 × 64 px`, () => {
      const gear = gearOf(window);
      expect(gear.gearSize).toBe(PHONE_GEAR_SIZE);
      expect(gear.hitSize).toBe(PHONE_HIT_SIZE);
    });

    it(`${window.name}: kolečko je uprostřed plochy pro prst`, () => {
      const gear = gearOf(window);
      const hit = hitBoxOf(window, gear);
      const drawn = gearBoxOf(window, gear);
      expect(drawn.left - hit.left).toBeCloseTo(hit.right - drawn.right, 5);
      expect(drawn.top - hit.top).toBeCloseTo(hit.bottom - drawn.bottom, 5);
      expect(isInside(drawn, hit)).toBe(true);
    });

    it(`${window.name}: kroužek při podržení obepíná kolečko, vejde se do plochy pro prst a má čáru aspoň 3 px`, () => {
      const gear = gearOf(window);
      expect(gear.ringStrokeWidth).toBeGreaterThanOrEqual(MIN_RING_STROKE);
      // Vnitřní okraj čáry je kolem kresleného kolečka, vnější se vejde do plochy pro prst.
      expect(gear.ringDiameter - gear.ringStrokeWidth).toBeGreaterThanOrEqual(
        gear.gearSize - TOLERANCE,
      );
      expect(gear.ringDiameter + gear.ringStrokeWidth).toBeLessThanOrEqual(
        gear.hitSize + TOLERANCE,
      );
    });
  }

  it('úzký iPad (Split View) dostane malé kolečko záměrně, kratší strana je pod 500 px', () => {
    const splitView = windowOf('375×1180 iPad Split View', 375, 1180);
    const gear = gearOf(splitView);
    expect(gear.gearSize).toBe(PHONE_GEAR_SIZE);
    expect(gear.hitSize).toBe(PHONE_HIT_SIZE);
  });
});

describe('AC3: na iPadu zůstane kolečko jako dnes', () => {
  for (const window of TABLET_GEAR_WINDOWS) {
    it(`${window.name}: kolečko má 76 × 76 px a je 12 px od horního a pravého okraje`, () => {
      const gear = gearOf(window);
      const free = freeAreaOf(window);
      const drawn = gearBoxOf(window, gear);
      expect(gear.gearSize).toBe(TABLET_GEAR_SIZE);
      expect(drawn.top - free.top).toBeCloseTo(TABLET_EDGE_OFFSET, 5);
      expect(free.right - drawn.right).toBeCloseTo(TABLET_EDGE_OFFSET, 5);
    });

    it(`${window.name}: plocha pro prst je stejná jako kolečko, jako dnes`, () => {
      const gear = gearOf(window);
      expect(gear.hitSize).toBe(TABLET_GEAR_SIZE);
    });
  }

  it('okno 932×499 má malé kolečko, 932×500 už kolečko iPadu (hranice 500 px)', () => {
    expect(gearOf(windowOf('932×499', 932, 499)).gearSize).toBe(PHONE_GEAR_SIZE);
    expect(gearOf(JUST_ABOVE_LIMIT).gearSize).toBe(TABLET_GEAR_SIZE);
  });
});

/**
 * Pro okna na výšku nahrazuje kritérium „kolečko nepřekrývá zmenšenou hru“
 * #56 (AC1 a AC2): telefon na výšku má herní plochu přes celou volnou plochu
 * a kolečko je nad ní vpravo nahoře vedle hvězdiček. Že nepřekrývá žádný
 * prvek hry, hlídá `phonePortraitLayout.test.ts`. Velikost a odsazení
 * kolečka na výšku zůstávají z #55.
 */
describe('AC4: na telefonu na výšku (a v okně 667×320) je kolečko malé', () => {
  for (const window of [...PHONE_PORTRAIT_WINDOWS, IPHONE_SE_LANDSCAPE]) {
    it(`${window.name}: kolečko má 48 × 48 px a plocha pro prst 64 × 64 px`, () => {
      const gear = gearOf(window);
      expect(gear.gearSize).toBe(PHONE_GEAR_SIZE);
      expect(gear.hitSize).toBe(PHONE_HIT_SIZE);
    });

    it(`${window.name}: plocha pro prst je 8 px od horního a pravého okraje volné plochy`, () => {
      const free = freeAreaOf(window);
      const hit = hitBoxOf(window, gearOf(window));
      expect(hit.top - free.top).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
      expect(free.right - hit.right).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
    });
  }

  it(`${IPHONE_SE_LANDSCAPE.name}: plocha pro prst nepřekrývá zmenšenou hru`, () => {
    const hit = hitBoxOf(IPHONE_SE_LANDSCAPE, gearOf(IPHONE_SE_LANDSCAPE));
    const game = gameBoxOf(gameAreaFor(viewportOf(IPHONE_SE_LANDSCAPE)));
    expect(overlaps(hit, game)).toBe(false);
  });
});

describe('AC5: po otočení telefonu nebo změně lišty se kolečko přepočítá', () => {
  const landscape = windowOf('844×340 iPhone', 844, 340, {
    top: 0,
    right: 47,
    bottom: 21,
    left: 47,
  });
  const portrait = windowOf('390×844 iPhone na výšku', 390, 844, IPHONE_PORTRAIT_NOTCH);
  const barHidden = windowOf('844×390 iPhone bez lišty', 844, 390, landscape.safeArea);

  it('po otočení na výšku a zpět je kolečko stejné jako před otočením', () => {
    const before = gearOf(landscape);
    gearOf(portrait);
    expect(gearOf(landscape)).toEqual(before);
  });

  it('po otočení odpovídá kolečko novému oknu, ne tomu předchozímu', () => {
    gearOf(landscape);
    const afterRotation = gearOf(portrait);
    const free = freeAreaOf(portrait);
    const hit = hitBoxOf(portrait, afterRotation);
    expect(hit.top - free.top).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
    expect(free.right - hit.right).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
  });

  it('po schování lišty zůstane kolečko 8 px od rohu volné plochy', () => {
    for (const window of [landscape, barHidden, landscape]) {
      const free = freeAreaOf(window);
      const hit = hitBoxOf(window, gearOf(window));
      expect(hit.top - free.top, window.name).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
      expect(free.right - hit.right, window.name).toBeCloseTo(PHONE_EDGE_OFFSET, 5);
    }
  });

  it('po otočení z telefonu na iPad rozměry se kolečko zvětší na 76 px a zpět zmenší', () => {
    expect(gearOf(landscape).gearSize).toBe(PHONE_GEAR_SIZE);
    expect(gearOf(windowOf('iPad 1180×820', 1180, 820)).gearSize).toBe(TABLET_GEAR_SIZE);
    expect(gearOf(landscape).gearSize).toBe(PHONE_GEAR_SIZE);
  });

  it('přepočet kolečka nezmění údaje o okně, které dostal', () => {
    const viewport = viewportOf(landscape);
    const copy = JSON.parse(JSON.stringify(viewport)) as Viewport;
    settingsGearFor(viewport);
    expect(viewport).toEqual(copy);
  });
});

describe('AC7: nesmyslná velikost okna dá kolečko jako dnes na iPadu', () => {
  function expectTabletFallback(gear: SettingsGear): void {
    expect(gear.gearSize).toBe(TABLET_GEAR_SIZE);
    expect(gear.hitSize).toBe(TABLET_GEAR_SIZE);
    expect(gear.top).toBe(TABLET_EDGE_OFFSET);
    expect(gear.right).toBe(TABLET_EDGE_OFFSET);
  }

  it('když prohlížeč velikost okna nepošle, kolečko má 76 px a 12 px od okraje', () => {
    expectTabletFallback(settingsGearFor(undefined));
  });

  const nonsense: Array<[string, Viewport]> = [
    ['šířka 0', { width: 0, height: 340, safeArea: NO_NOTCH }],
    ['výška 0', { width: 844, height: 0, safeArea: NO_NOTCH }],
    ['okno 0 × 0', { width: 0, height: 0, safeArea: NO_NOTCH }],
    ['záporná šířka', { width: -844, height: 340, safeArea: NO_NOTCH }],
    ['šířka NaN', { width: Number.NaN, height: 340, safeArea: NO_NOTCH }],
    ['nekonečná výška', { width: 844, height: Number.POSITIVE_INFINITY, safeArea: NO_NOTCH }],
    ['chybí výřez', { width: 844, height: 340 } as unknown as Viewport],
    ['chybí šířka a výška', { safeArea: NO_NOTCH } as unknown as Viewport],
  ];

  for (const [name, viewport] of nonsense) {
    it(`${name}: hra nespadne a kolečko je jako dnes na iPadu`, () => {
      expect(() => settingsGearFor(viewport)).not.toThrow();
      expectTabletFallback(settingsGearFor(viewport));
    });
  }
});
