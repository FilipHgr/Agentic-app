import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import {
  gameAreaFor,
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
  settingsGearFor,
} from '../src/logic/deviceLayout';
import type {
  GameArea,
  PhoneScreenLayout,
  PhoneWritingLayout,
  SettingsGear,
  Viewport,
} from '../src/logic/deviceLayout';
import type { Problem } from '../src/logic/problems';
import type { ButtonSlot, HintDot } from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_WINDOWS,
  box,
  freeAreaOf,
  gapBetween,
  gearCornerOf,
  heightOf,
  isInside,
  overlaps,
  toCss,
  viewportOf,
  widthOf,
} from './viewportFixtures';
import type { Box, TestSafeArea, TestWindow } from './viewportFixtures';

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
 * tests/settings.test.ts („AC1: nastavení se otevře až po podržení
 * kolečka“) a tests/setupGuide.test.ts (`canOpenSettingsByHold`).
 */

const PHONE_GEAR_SIZE = 48;
const PHONE_HIT_SIZE = 64;
const PHONE_EDGE_OFFSET = 8;
const MIN_GAP_TO_CONTROLS = 8;
const MIN_RING_STROKE = 3;

const TABLET_GEAR_SIZE = 76;
const TABLET_EDGE_OFFSET = 12;

const TOLERANCE = 0.01;

const RANGES: MaxNumber[] = [5, 10, 20];
type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

function windowOf(name: string, width: number, height: number, safeArea = NO_NOTCH): TestWindow {
  return { name, width, height, safeArea };
}

/** iPhone SE na šířku: telefon, ale hra je zmenšená (režim `scaled`). */
const IPHONE_SE_LANDSCAPE = windowOf('667×320 iPhone SE', 667, 320);

const IPHONE_PORTRAIT_NOTCH: TestSafeArea = { top: 47, right: 0, bottom: 34, left: 0 };

/** Telefon na výšku (AC4). */
const PHONE_PORTRAIT_WINDOWS: readonly TestWindow[] = [
  windowOf('390×844 iPhone na výšku', 390, 844, IPHONE_PORTRAIT_NOTCH),
  windowOf('360×780 Samsung na výšku', 360, 780),
];

/** iPad, kde se kolečko nemění (AC3). */
const TABLET_GEAR_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  windowOf('820×1180 iPad na výšku', 820, 1180),
];

function gearOf(window: TestWindow): SettingsGear {
  return settingsGearFor(viewportOf(window));
}

/** Plocha pro prst v souřadnicích okna. */
function hitBoxOf(window: TestWindow, gear: SettingsGear): Box {
  const right = window.width - gear.right;
  return { left: right - gear.hitSize, right, top: gear.top, bottom: gear.top + gear.hitSize };
}

/** Kreslené kolečko: uprostřed plochy pro prst. */
function gearBoxOf(window: TestWindow, gear: SettingsGear): Box {
  const hit = hitBoxOf(window, gear);
  const centerX = (hit.left + hit.right) / 2;
  const centerY = (hit.top + hit.bottom) / 2;
  return box(centerX, centerY, gear.gearSize, gear.gearSize);
}

/** Celá herní plocha v okně v CSS px. */
function gameBoxOf(area: GameArea): Box {
  return toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
}

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

describe('AC4: na telefonu na výšku (a v okně 667×320) je kolečko malé a mimo zmenšenou hru', () => {
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

    it(`${window.name}: plocha pro prst nepřekrývá zmenšenou hru`, () => {
      const hit = hitBoxOf(window, gearOf(window));
      const game = gameBoxOf(gameAreaFor(viewportOf(window)));
      expect(overlaps(hit, game)).toBe(false);
    });
  }
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
