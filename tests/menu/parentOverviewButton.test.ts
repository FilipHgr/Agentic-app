import { afterEach, describe, expect, it, vi } from 'vitest';

import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { createMenuTouch } from '../../src/menu/logic/menuTouch';
import type { MenuTouch } from '../../src/menu/logic/menuTouch';
import { HOLD_TO_OPEN_SETTINGS_MS } from '../../src/shared/logic/settingsGear';
import { MIN_TAP_GAP, MIN_TAP_SIDE } from '../shared/layoutRules';
import { gapBetween, heightOf, viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MANY_GAMES, MANY_TEXTS_CS } from './manyGamesFixtures';
import { TestLanguages, testMenu, translatorOf } from './menuFixtures';
import type { TestMenu } from './menuFixtures';
import { FEW_GAMES_WINDOWS, todayLayout } from './menuLayoutScenes';

/**
 * Testy k #192 AC1: tlačítko přehledu pro rodiče v liště menu. Je na
 * vyhrazeném místě mezi profilem a jazykem (#157), kulaté 64 px se
 * symbolem bez textu. Otevře se jen podržením 1 s s kroužkem jako kolečko
 * nastavení ve hře (rodičovská brána), ťuknutí ho jen zhoupne. Čas dotyků
 * jde do logiky dotyků zvenku (`nowMs`), jako to dělá scéna menu.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Menu se zkušebními hrami ovládané prstem nad rozložením okna `window`. */
class Finger {
  readonly test: TestMenu;
  readonly touch: MenuTouch;
  now = 1000;

  constructor(
    private readonly window: TestWindow,
    many = false,
  ) {
    this.test = many
      ? testMenu({
          games: MANY_GAMES,
          translate: translatorOf(MANY_TEXTS_CS),
          languages: new TestLanguages(),
        })
      : testMenu({ languages: new TestLanguages() });
    this.touch = createMenuTouch({ menu: this.test.menu });
    this.touch.setLayout(this.layout());
  }

  layout(): MenuLayout {
    const menu = this.test.menu;
    return menuLayoutFor(viewportOf(this.window), {
      categoryTitles: menu.categories().map((category) => category.title),
      tileCount: menu.tiles().length,
      languageNames: menu.languages().map((language) => language.name),
    });
  }

  button(): { x: number; y: number } {
    return centerOf(this.layout().overviewButton);
  }

  down(point = this.button(), pointerId = 1): void {
    this.touch.pointerDown(pointerId, point, this.now);
  }

  /** Prst drží `ms`, scéna mezitím kreslí snímky po 16 ms. */
  hold(ms: number): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now = Math.min(end, this.now + 16);
      this.touch.frame(this.now);
    }
  }

  move(point: { x: number; y: number }, pointerId = 1): void {
    this.now += 16;
    this.touch.pointerMove(pointerId, point, this.now);
  }

  up(point = this.button(), pointerId = 1): void {
    this.touch.pointerUp(pointerId, point, this.now);
    this.touch.setLayout(this.layout());
  }

  tap(point = this.button()): void {
    this.down(point);
    this.hold(80);
    this.up(point);
  }

  wobbles(): number {
    return this.test.feedback.filter(
      (event) => event.kind === 'wobble' && event.target.kind === 'overviewButton',
    ).length;
  }
}

function centerOf(box: MenuBox): { x: number; y: number } {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

describe('#192 AC1: tlačítko přehledu je v liště na vyhrazeném místě', () => {
  it('v každém okně je mezi profilem a jazykem, kulaté aspoň 64 px a ve výšce lišty', () => {
    const problems = FEW_GAMES_WINDOWS.flatMap((window) => {
      const layout = todayLayout(window);
      const button = layout.overviewButton;
      const issues: string[] = [];
      if (widthOf(button) < MIN_TAP_SIDE || heightOf(button) < MIN_TAP_SIDE) {
        issues.push(`${window.name}: tlačítko má ${widthOf(button)} × ${heightOf(button)} px`);
      }
      if (widthOf(button) !== heightOf(button)) {
        issues.push(`${window.name}: tlačítko není kulaté`);
      }
      if (button.left < layout.profileSlot.right || button.right > layout.languageSlot.left) {
        issues.push(`${window.name}: tlačítko není mezi profilem a jazykem`);
      }
      if (button.top !== layout.languageSlot.top) {
        issues.push(`${window.name}: tlačítko není ve výšce jazyka`);
      }
      if (gapBetween(button, layout.languageSlot) < MIN_TAP_GAP) {
        issues.push(`${window.name}: tlačítko je k jazyku blíž než 8 px`);
      }
      return issues;
    });
    expect(problems).toEqual([]);
  });

  it('tlačítko nemá žádný text, jen symbol (rozložení mu písmo nedává)', () => {
    const layout = todayLayout(FEW_GAMES_WINDOWS[0] as TestWindow);
    expect(Object.keys(layout.overviewButton).sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });
});

describe('#192 AC1: přehled se otevře podržením 1 s, ťuknutí tlačítko jen zhoupne', () => {
  for (const window of FEW_GAMES_WINDOWS) {
    describe(window.name, () => {
      it('ťuknutí tlačítko zhoupne s tichým tónem a přehled neotevře', () => {
        const finger = new Finger(window);
        finger.tap();
        expect(finger.test.overviewOpened()).toBe(0);
        expect(finger.wobbles()).toBe(1);
        expect(finger.test.sounds()).toEqual(['wobble']);
      });

      it('podržení 1 s přehled otevře se zvukem, ještě před zvednutím prstu', () => {
        const finger = new Finger(window);
        finger.down();
        finger.hold(HOLD_TO_OPEN_SETTINGS_MS - 20);
        expect(finger.test.overviewOpened()).toBe(0);
        finger.hold(40);
        expect(finger.test.overviewOpened()).toBe(1);
        finger.up();
        expect(finger.test.overviewOpened()).toBe(1);
        expect(finger.wobbles()).toBe(0);
        expect(finger.test.sounds()).toEqual(['press']);
      });

      it('kratší podržení je jen ťuknutí', () => {
        const finger = new Finger(window);
        finger.down();
        finger.hold(HOLD_TO_OPEN_SETTINGS_MS / 2);
        finger.up();
        expect(finger.test.overviewOpened()).toBe(0);
        expect(finger.wobbles()).toBe(1);
      });
    });
  }

  it('během držení se plní kroužek od 0 do 1, po zvednutí zmizí', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    expect(finger.touch.overviewHoldProgress(finger.now)).toBeNull();
    finger.down();
    expect(finger.touch.overviewHoldProgress(finger.now)).toBe(0);
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS / 2);
    expect(finger.touch.overviewHoldProgress(finger.now)).toBeCloseTo(0.5, 2);
    finger.up();
    expect(finger.touch.overviewHoldProgress(finger.now)).toBeNull();
  });

  it('kroužek po otevření přehledu zmizí', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.down();
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS + 50);
    expect(finger.test.overviewOpened()).toBe(1);
    expect(finger.touch.overviewHoldProgress(finger.now)).toBeNull();
  });

  it('sjetí prstu z tlačítka podržení zruší: přehled se neotevře a tlačítko se jednou zhoupne', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    const layout = finger.layout();
    finger.down();
    finger.hold(300);
    const outside = { x: finger.button().x, y: layout.overviewButton.bottom + 30 };
    finger.move(outside);
    expect(finger.touch.overviewHoldProgress(finger.now)).toBeNull();
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS);
    finger.up(outside);
    expect(finger.test.overviewOpened()).toBe(0);
    expect(finger.wobbles()).toBe(1);
  });

  it('podržení platí i během dojíždění posouvání mřížky: dotyk dojíždění zastaví', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow, true);
    const layout = finger.layout();
    expect(layout.gridScroll.maxOffset).toBeGreaterThan(0);
    const grid = layout.gridScroll.viewport;
    const start = { x: (grid.left + grid.right) / 2, y: grid.bottom - 40 };
    finger.down(start);
    for (let step = 1; step <= 5; step += 1) {
      finger.move({ x: start.x, y: start.y - step * 40 });
    }
    finger.up({ x: start.x, y: start.y - 200 });
    finger.hold(16);
    const coasting = finger.touch.gridOffset();
    finger.hold(16);
    expect(finger.touch.gridOffset()).not.toBe(coasting);

    finger.down();
    const stopped = finger.touch.gridOffset();
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS + 20);
    expect(finger.touch.gridOffset()).toBe(stopped);
    expect(finger.test.overviewOpened()).toBe(1);
  });

  it('malý pohyb prstu uvnitř tlačítka podržení nezruší', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    const start = finger.button();
    finger.down(start);
    finger.move({ x: start.x + 3, y: start.y + 2 });
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS + 20);
    expect(finger.test.overviewOpened()).toBe(1);
  });

  it('druhý prst podržení nepřeruší ani neprodlouží', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.down();
    finger.hold(500);
    finger.down(finger.button(), 2);
    finger.up(finger.button(), 2);
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS - 500 + 20);
    expect(finger.test.overviewOpened()).toBe(1);
  });

  it('když se snímek zpozdí, prst zvednutý po celé době se počítá jako podržení', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.down();
    finger.now += HOLD_TO_OPEN_SETTINGS_MS + 100;
    finger.up();
    expect(finger.test.overviewOpened()).toBe(1);
    expect(finger.wobbles()).toBe(0);
  });

  it('systém dotyk zruší: nic se neotevře', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.down();
    finger.hold(300);
    finger.touch.pointerCancel(1);
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS);
    expect(finger.test.overviewOpened()).toBe(0);
  });

  it('s otevřenou nabídkou jazyků podržení jen nabídku zavře', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.tap(centerOf(finger.layout().languageSlot));
    expect(finger.test.menu.isLanguageMenuOpen()).toBe(true);
    finger.down();
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS + 50);
    finger.up();
    expect(finger.test.menu.isLanguageMenuOpen()).toBe(false);
    expect(finger.test.overviewOpened()).toBe(0);
  });

  it('podržení během stahování hry stahování zruší a otevře přehled, hra nenaběhne', async () => {
    vi.useFakeTimers();
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.test.menu.tapTile('zebra');
    finger.down();
    finger.hold(HOLD_TO_OPEN_SETTINGS_MS + 50);
    finger.up();
    finger.test.download.succeed();
    await vi.advanceTimersByTimeAsync(1000);
    expect(finger.test.overviewOpened()).toBe(1);
    expect(finger.test.menu.runningGame()).toBeNull();
    expect(finger.test.game.started).toEqual([]);
  });

  it('ťuknutí během stahování hru nezruší, hra po stažení naběhne', async () => {
    vi.useFakeTimers();
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.test.menu.tapTile('zebra');
    finger.tap();
    finger.test.download.succeed();
    await vi.advanceTimersByTimeAsync(1000);
    expect(finger.test.menu.runningGame()?.id).toBe('zebra');
    expect(finger.test.overviewOpened()).toBe(0);
  });

  it('prst na tlačítku nic jiného nezmáčkne a tah z něj nic neposune', () => {
    const finger = new Finger(FEW_GAMES_WINDOWS[0] as TestWindow);
    finger.down();
    expect(finger.touch.pressed()).toBeUndefined();
    const start = finger.button();
    finger.move({ x: start.x - 200, y: start.y + 200 });
    finger.up({ x: start.x - 200, y: start.y + 200 });
    expect(finger.touch.gridOffset()).toBe(0);
    expect(finger.test.overviewOpened()).toBe(0);
  });
});
