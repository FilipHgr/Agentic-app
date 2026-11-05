import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HOLD_TO_GO_HOME_MS, homeButtonFor } from '../../src/shared/logic/homeButton';
import type { HomeButton } from '../../src/shared/logic/homeButton';
import { createHoldButton } from '../../src/shared/logic/holdButton';
import type { HoldButton } from '../../src/shared/logic/holdButton';
import { HOLD_TO_OPEN_SETTINGS_MS, settingsGearFor } from '../../src/shared/logic/settingsGear';
import type { SettingsGear } from '../../src/shared/logic/settingsGear';
import type { Viewport } from '../../src/shared/logic/viewportLayout';
import {
  IPHONE_SE_LANDSCAPE,
  PHONE_HIT_SIZE,
  PHONE_PORTRAIT_WINDOWS,
  TABLET_GEAR_SIZE,
  TABLET_GEAR_WINDOWS,
  windowOf,
} from './settingsGearFixtures';
import {
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  overlaps,
  viewportOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Testy k #68 (domeček ve hře, podržením 1 s zpět do menu), sdílená část:
 * - AC1: poloha a velikost domečku vlevo nahoře, zrcadlově ke kolečku
 *   nastavení (#36, #55). Vše v CSS px.
 * - AC2: logika podržení. Stejná jako u kolečka: podržení 1 s, kratší
 *   podržení nebo ťuknutí jen zhoupne, sjetí prstu odchod zruší a druhý
 *   prst podržení nepřeruší.
 *
 * Navržené rozhraní:
 * - `homeButtonFor(viewport)` v `src/shared/logic/homeButton.ts` vrátí
 *   `HomeButton` (`iconSize`, `hitSize`, `top`, `left`, `ringDiameter`,
 *   `ringStrokeWidth`): `top` je horní okraj plochy pro prst od horního
 *   okraje okna, `left` levý okraj od levého okraje okna, obojí i s výřezem.
 * - `HOLD_TO_GO_HOME_MS` jak dlouho se domeček drží.
 * - `createHoldButton(options)` v `src/shared/logic/holdButton.ts`: logika
 *   podržení bez DOM, kterou použije domeček i kolečko. Čas běží přes
 *   `setTimeout`, testy ho posouvají falešnými hodinami Vitestu.
 *
 * Kreslení kroužku, zhoupnutí a zvuk se kontrolují ručně v náhledu.
 */

const TOLERANCE = 0.01;

/** Plocha pro prst u domečku v souřadnicích okna. */
function homeHitBoxOf(home: HomeButton): Box {
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

/** Plocha pro prst u kolečka v souřadnicích okna. */
function gearHitBoxOf(window: TestWindow, gear: SettingsGear): Box {
  const right = window.width - gear.right;
  return { left: right - gear.hitSize, right, top: gear.top, bottom: gear.top + gear.hitSize };
}

function homeOf(window: TestWindow): HomeButton {
  return homeButtonFor(viewportOf(window));
}

function gearOf(window: TestWindow): SettingsGear {
  return settingsGearFor(viewportOf(window));
}

const IPHONE_LANDSCAPE_LEFT_NOTCH = windowOf('844×390 iPhone, výřez jen vlevo', 844, 390, {
  top: 0,
  right: 0,
  bottom: 21,
  left: 47,
});

const ALL_WINDOWS: readonly TestWindow[] = [
  ...PHONE_WINDOWS,
  IPHONE_SE_LANDSCAPE,
  IPHONE_LANDSCAPE_LEFT_NOTCH,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...TABLET_GEAR_WINDOWS,
];

describe('AC1: domeček je vlevo nahoře zrcadlově ke kolečku nastavení', () => {
  for (const window of ALL_WINDOWS) {
    it(`${window.name}: domeček má stejnou velikost, plochu pro prst a kroužek jako kolečko`, () => {
      const home = homeOf(window);
      const gear = gearOf(window);

      expect(home.iconSize).toBe(gear.gearSize);
      expect(home.hitSize).toBe(gear.hitSize);
      expect(home.ringDiameter).toBeCloseTo(gear.ringDiameter, 5);
      expect(home.ringStrokeWidth).toBeCloseTo(gear.ringStrokeWidth, 5);
    });

    it(`${window.name}: domeček má stejný odstup od horního a levého okraje volné plochy jako kolečko od horního a pravého`, () => {
      const free = freeAreaOf(window);
      const home = homeHitBoxOf(homeOf(window));
      const gear = gearHitBoxOf(window, gearOf(window));

      expect(home.top).toBeCloseTo(gear.top, 5);
      expect(home.left - free.left).toBeCloseTo(free.right - gear.right, 5);
    });

    it(`${window.name}: domeček a kolečko se nepřekrývají a mezi nimi je aspoň 8 px`, () => {
      const home = homeHitBoxOf(homeOf(window));
      const gear = gearHitBoxOf(window, gearOf(window));

      expect(overlaps(home, gear)).toBe(false);
      expect(gear.left - home.right).toBeGreaterThanOrEqual(8 - TOLERANCE);
    });
  }

  for (const window of TABLET_GEAR_WINDOWS) {
    it(`${window.name}: na iPadu má domeček 76 px a je 12 px od horního a levého okraje`, () => {
      const home = homeOf(window);

      expect(home.iconSize).toBe(TABLET_GEAR_SIZE);
      expect(home.hitSize).toBe(TABLET_GEAR_SIZE);
      expect(home.top).toBeCloseTo(12, 5);
      expect(home.left).toBeCloseTo(12, 5);
    });
  }

  for (const window of [...PHONE_WINDOWS, ...PHONE_PORTRAIT_WINDOWS]) {
    it(`${window.name}: na telefonu má domeček plochu pro prst 64 × 64 px, 8 px od okraje volné plochy`, () => {
      const free = freeAreaOf(window);
      const home = homeOf(window);

      expect(home.hitSize).toBe(PHONE_HIT_SIZE);
      expect(home.top - free.top).toBeCloseTo(8, 5);
      expect(home.left - free.left).toBeCloseTo(8, 5);
    });
  }

  it('s výřezem jen vlevo je domeček vpravo od výřezu, kolečko u pravého okraje okna', () => {
    const home = homeOf(IPHONE_LANDSCAPE_LEFT_NOTCH);
    const gear = gearOf(IPHONE_LANDSCAPE_LEFT_NOTCH);

    expect(home.left).toBeCloseTo(47 + 8, 5);
    expect(gear.right).toBeCloseTo(8, 5);
  });

  it('po otočení telefonu a zpět je domeček stejný jako před otočením', () => {
    const landscape = PHONE_WINDOWS[2] as TestWindow;
    const portrait = PHONE_PORTRAIT_WINDOWS[0] as TestWindow;
    const before = homeOf(landscape);

    homeOf(portrait);

    expect(homeOf(landscape)).toEqual(before);
  });

  const nonsense: Array<[string, Viewport | undefined]> = [
    ['chybí okno', undefined],
    ['šířka 0', { width: 0, height: 340, safeArea: NO_NOTCH }],
    ['šířka NaN', { width: Number.NaN, height: 340, safeArea: NO_NOTCH }],
    ['chybí výřez', { width: 844, height: 340 } as unknown as Viewport],
  ];
  for (const [name, viewport] of nonsense) {
    it(`${name}: hra nespadne a domeček je jako na iPadu (76 px, 12 px od okraje)`, () => {
      expect(() => homeButtonFor(viewport)).not.toThrow();
      const home = homeButtonFor(viewport);
      expect(home.hitSize).toBe(TABLET_GEAR_SIZE);
      expect(home.top).toBe(12);
      expect(home.left).toBe(12);
    });
  }
});

// ---------------------------------------------------------------------------
// AC2: podržení
// ---------------------------------------------------------------------------

interface TestHold {
  readonly button: HoldButton;
  /** Kolikrát se podržení dokončilo (dítě odešlo do menu). */
  completed(): number;
  /** Kolikrát se domeček jen zhoupl. */
  wobbled(): number;
}

function testHold(holdMs = HOLD_TO_GO_HOME_MS, enabled: () => boolean = () => true): TestHold {
  let completed = 0;
  let wobbled = 0;
  const button = createHoldButton({
    holdMs,
    isEnabled: enabled,
    onHoldComplete: () => {
      completed += 1;
    },
    onTap: () => {
      wobbled += 1;
    },
  });
  return { button, completed: () => completed, wobbled: () => wobbled };
}

const FINGER = 1;
const SECOND_FINGER = 2;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AC2: domeček odejde do menu jen podržením 1 s, stejně jako kolečko', () => {
  it('domeček se drží stejně dlouho jako kolečko, 1 s', () => {
    expect(HOLD_TO_GO_HOME_MS).toBe(1000);
    expect(HOLD_TO_GO_HOME_MS).toBe(HOLD_TO_OPEN_SETTINGS_MS);
  });

  it('podržení 0,99 s neodejde', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(990);

    expect(hold.completed()).toBe(0);
    expect(hold.button.isHolding()).toBe(true);
  });

  it('podržení 1 s odejde, a to jen jednou', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(1000);

    expect(hold.completed()).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(hold.completed()).toBe(1);
  });

  it('odchod přijde už během držení, dítě nemusí prst zvednout', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(1000);

    expect(hold.completed()).toBe(1);
  });

  it('puštění po 1 s domeček nezhoupne a neodejde podruhé', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(1200);
    hold.button.release(FINGER);

    expect(hold.completed()).toBe(1);
    expect(hold.wobbled()).toBe(0);
  });

  it('během držení se kolem domečku plní kroužek, po dokončení zmizí', () => {
    const hold = testHold();
    expect(hold.button.isHolding()).toBe(false);

    hold.button.press(FINGER);
    expect(hold.button.isHolding()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(hold.button.isHolding()).toBe(false);
  });
});

describe('AC2: ťuknutí nebo kratší podržení domeček jen zhoupne', () => {
  it('ťuknutí domeček zhoupne a neodejde', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(80);
    hold.button.release(FINGER);
    vi.advanceTimersByTime(5000);

    expect(hold.wobbled()).toBe(1);
    expect(hold.completed()).toBe(0);
  });

  it('puštění po 0,99 s kroužek vrátí, domeček zhoupne a neodejde ani později', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(990);
    hold.button.release(FINGER);

    expect(hold.button.isHolding()).toBe(false);
    expect(hold.wobbled()).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(hold.completed()).toBe(0);
  });

  it('po puštění a novém podržení se počítá 1 s znovu od začátku', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(700);
    hold.button.release(FINGER);
    hold.button.press(FINGER);
    vi.advanceTimersByTime(700);

    expect(hold.completed()).toBe(0);
    vi.advanceTimersByTime(300);
    expect(hold.completed()).toBe(1);
  });

  it('přerušený dotyk (pointercancel) se počítá jako puštění', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(500);
    hold.button.cancel(FINGER);
    vi.advanceTimersByTime(5000);

    expect(hold.button.isHolding()).toBe(false);
    expect(hold.completed()).toBe(0);
  });
});

describe('AC2: když prst sjede z domečku, odchod se zruší', () => {
  it('sjetí prstu kroužek vrátí a po 1 s se neodejde', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(500);
    hold.button.leave(FINGER);

    expect(hold.button.isHolding()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(hold.completed()).toBe(0);
  });

  it('puštění prstu, který už sjel, domeček nezhoupne', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(300);
    hold.button.leave(FINGER);
    hold.button.release(FINGER);

    expect(hold.wobbled()).toBe(0);
    expect(hold.completed()).toBe(0);
  });
});

describe('AC2: druhý prst podržení domečku nepřeruší', () => {
  it('ťuknutí druhým prstem jinam (puštění i sjetí) nechá domeček držet a po 1 s se odejde', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(300);
    hold.button.release(SECOND_FINGER);
    hold.button.leave(SECOND_FINGER);
    hold.button.cancel(SECOND_FINGER);

    expect(hold.button.isHolding()).toBe(true);
    vi.advanceTimersByTime(700);
    expect(hold.completed()).toBe(1);
    expect(hold.wobbled()).toBe(0);
  });

  it('druhý prst na domečku držení neprodlouží ani nezkrátí', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(500);
    hold.button.press(SECOND_FINGER);
    vi.advanceTimersByTime(500);

    expect(hold.completed()).toBe(1);
  });
});

describe('AC4: vypnutý domeček nereaguje (otevřené nastavení nebo průvodce)', () => {
  it('podržení vypnutého domečku neodejde, nezhoupne ho a kroužek se neplní', () => {
    const hold = testHold(HOLD_TO_GO_HOME_MS, () => false);
    hold.button.press(FINGER);
    expect(hold.button.isHolding()).toBe(false);
    vi.advanceTimersByTime(2000);
    hold.button.release(FINGER);

    expect(hold.completed()).toBe(0);
    expect(hold.wobbled()).toBe(0);
  });

  it('když se nastavení otevře během držení, odchod se zruší', () => {
    let enabled = true;
    const hold = testHold(HOLD_TO_GO_HOME_MS, () => enabled);
    hold.button.press(FINGER);
    vi.advanceTimersByTime(500);
    enabled = false;
    vi.advanceTimersByTime(500);

    expect(hold.completed()).toBe(0);
  });
});

describe('AC5: odpojené podržení už nic neudělá', () => {
  it('po odpojení (odchod z hry) nedoběhne rozběhnuté držení a nové nezačne', () => {
    const hold = testHold();
    hold.button.press(FINGER);
    vi.advanceTimersByTime(500);
    hold.button.dispose();
    vi.advanceTimersByTime(5000);
    hold.button.press(FINGER);
    vi.advanceTimersByTime(5000);
    hold.button.release(FINGER);

    expect(hold.completed()).toBe(0);
    expect(hold.wobbled()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
