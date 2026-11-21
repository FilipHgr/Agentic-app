import { describe, expect, it } from 'vitest';

import { MENU_GREETING_WAIT_MS, createMenuMascotCues } from '../../src/menu/logic/menuMascot';
import type { MenuMascotCues, MenuShownReason } from '../../src/menu/logic/menuMascot';
import { MENU_LAYERS } from '../../src/menu/logic/menuLayers';
import type { MenuFeedback } from '../../src/menu/logic/menu';
import { createMascotModel, moveDurationMs } from '../../src/shared/logic/mascot';
import type { MascotModel, MascotMove } from '../../src/shared/logic/mascot';
import { soundsOf, testMenu } from './menuFixtures';
import { FingerMenu, MANY_GAMES, centerOf, findWindow } from './manyGamesFixtures';
import type { Point } from './manyGamesFixtures';

/**
 * Testy k #168 AC3–AC5: co panda v menu dělá.
 *
 * Rozhraní (čistý TypeScript bez Phaseru):
 * - `createMenuMascotCues()` (`src/menu/logic/menuMascot.ts`) říká, kdy
 *   panda zamává a co udělá po ťuknutí; scéna mu hlásí, proč se menu
 *   ukázalo, jestli pro pandu je místo a jaké pohyby jsou stažené,
 * - `Menu.tapMascot()` a odezva `{ kind: 'mascot' }` s tónem jako
 *   zmáčknutí dlaždice, ťuknutí na pandu pozná logika dotyků podle
 *   `MenuLayout.mascot`,
 * - `MENU_LAYERS` (`src/menu/logic/menuLayers.ts`) je pořadí, ve kterém se
 *   vrstvy menu kreslí (každá svou kamerou, pozdější leží nad dřívější).
 *
 * Pohyb pandy hraje sdílený model z #166 (`createMascotModel`); tady se
 * zkouší spolu s ním, jak to udělá scéna.
 */

const READY = { idle: true, wave: true } as const;
const FRAME_MS = 16;

/** Panda v menu: pokyny z `cues` přehrává sdílený model, čas posouvá test. */
class TestPanda {
  readonly cues: MenuMascotCues = createMenuMascotCues();
  readonly model: MascotModel = createMascotModel();
  readonly played: MascotMove[] = [];
  now = 0;

  constructor() {
    for (const move of ['idle', 'wave', 'joy'] as const) {
      this.model.prepare(move);
      this.model.loaded(move);
    }
  }

  shown(reason: MenuShownReason): void {
    this.cues.menuShown(reason, this.now);
  }

  tap(): void {
    const move = this.cues.tapped(this.model.currentMove(this.now), this.now);
    if (move !== null) {
      this.play(move);
    }
  }

  wait(ms: number, ready: { idle: boolean; wave: boolean } = READY): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now = Math.min(end, this.now + FRAME_MS);
      this.model.update(this.now);
      const move = this.cues.step(this.now, ready);
      if (move !== null) {
        this.play(move);
      }
    }
  }

  private play(move: MascotMove): void {
    this.played.push(move);
    // Pozdrav se po dohrání uvolní; před dalším se stáhne znovu (`prepare`).
    this.model.prepare(move);
    this.model.loaded(move);
    this.model.play(move, this.now);
  }
}

describe('#168 AC3: panda zamává po otevření menu a po návratu ze hry', () => {
  it('po otevření menu panda jednou zamává, pak je v klidu', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(100);
    expect(panda.played).toEqual(['wave']);
    expect(panda.model.currentMove(panda.now)).toBe('wave');
    panda.wait(moveDurationMs() + 5000);
    expect(panda.played).toEqual(['wave']);
    expect(panda.model.currentMove(panda.now)).toBe('idle');
  });

  it('po návratu ze hry panda zamává znovu', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(moveDurationMs() + 1000);
    panda.shown('returnedFromGame');
    panda.wait(100);
    expect(panda.played).toEqual(['wave', 'wave']);
  });

  it('po změně profilu ani jazyka panda nezamává', () => {
    for (const reason of ['profileChosen', 'languageChanged'] as const) {
      const panda = new TestPanda();
      panda.shown('opened');
      panda.wait(moveDurationMs() + 1000);
      panda.shown(reason);
      panda.wait(5000);
      expect(panda.played, reason).toEqual(['wave']);
    }
  });

  it('nestažený pozdrav panda zamává, jakmile se stáhne, nejpozději do 2 s od ukázání', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(MENU_GREETING_WAIT_MS - 200, { idle: true, wave: false });
    expect(panda.played).toEqual([]);
    panda.wait(100);
    expect(panda.played).toEqual(['wave']);
  });

  it('pozdrav stažený později než za 2 s se vynechá a panda zůstane v klidu', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(MENU_GREETING_WAIT_MS + 100, { idle: true, wave: false });
    panda.wait(3000);
    expect(panda.played).toEqual([]);
    expect(panda.model.currentMove(panda.now)).toBe('idle');
  });

  it('dokud se nestáhne klid (panda není vidět), pozdrav čeká a 2 s se počítají až od ukázání pandy', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(5000, { idle: false, wave: false });
    expect(panda.played).toEqual([]);
    panda.wait(MENU_GREETING_WAIT_MS - 200, { idle: true, wave: false });
    panda.wait(100);
    expect(panda.played).toEqual(['wave']);
  });

  it('pozdrav se stahuje dopředu jen do zamávání, radost a klid vždy, když je panda vidět', () => {
    const cues = createMenuMascotCues();
    expect(cues.preparedMoves(true)).toEqual(['idle', 'joy']);
    cues.menuShown('opened', 0);
    expect(cues.preparedMoves(true)).toEqual(['idle', 'wave', 'joy']);
    expect(cues.step(10, READY)).toBe('wave');
    expect(cues.preparedMoves(true)).toEqual(['idle', 'joy']);
  });

  it('když místo pro pandu zmizí, panda nemává a v paměti zůstane jen klid', () => {
    const cues = createMenuMascotCues();
    cues.menuShown('opened', 0);
    cues.placeLost();
    expect(cues.preparedMoves(false)).toEqual(['idle']);
    expect(cues.step(10, READY)).toBeNull();
    expect(cues.preparedMoves(true)).toEqual(['idle', 'joy']);
  });

  it('menu otevřené bez místa pro pandu (telefon) a pak otočené panda nemává', () => {
    const cues = createMenuMascotCues();
    cues.placeLost();
    cues.menuShown('opened', 0);
    cues.placeLost();
    expect(cues.step(10, READY)).toBeNull();
  });
});

/** Menu se 2 hrami na iPadu 1180×820 (panda je vidět), ovládané prstem. */
function ipadMenu(windowName = 'iPad 1180×820'): FingerMenu {
  return new FingerMenu(findWindow(windowName), MANY_GAMES.slice(0, 2));
}

function pandaCenter(finger: FingerMenu): Point {
  const panda = finger.layout().mascot;
  expect(panda, finger.window.name).not.toBeNull();
  return centerOf(panda ?? { left: 0, right: 0, top: 0, bottom: 0 });
}

const mascotTaps = (feedback: readonly MenuFeedback[]): number =>
  feedback.filter((event) => event.kind === 'mascot').length;

describe('#168 AC4: ťuknutí na pandu zahraje radost a tón', () => {
  it('ťuknutí na pandu zahraje stejný tón jako zmáčknutí dlaždice', () => {
    const finger = ipadMenu();
    finger.tap(pandaCenter(finger));
    expect(mascotTaps(finger.feedback)).toBe(1);
    const tile = testMenu();
    tile.menu.tapTile('zebra');
    expect(soundsOf(finger.feedback)).toEqual(['press']);
    expect(soundsOf(finger.feedback)).toEqual(tile.sounds().slice(0, 1));
    expect(finger.started).toEqual([]);
  });

  it('ťuknutí na pandu ve všech oknech, kde je vidět, ťukne na ni, ne na dlaždici', () => {
    for (const name of ['iPad 1180×760', 'zmenšené zobrazení 820×1180', '499×932', '375×1180']) {
      const finger = ipadMenu(name);
      const panda = finger.layout().mascot;
      expect(panda, name).not.toBeNull();
      if (panda === null) {
        continue;
      }
      // Rohy ťukací plochy (o 1 px dovnitř) i střed.
      for (const point of [
        centerOf(panda),
        { x: panda.left + 1, y: panda.top + 1 },
        { x: panda.right - 1, y: panda.bottom - 1 },
      ]) {
        finger.tap(point);
      }
      expect(mascotTaps(finger.feedback), name).toBe(3);
      expect(finger.started, name).toEqual([]);
    }
  });

  it('ťuknutí na pandu zahraje radost', () => {
    const panda = new TestPanda();
    panda.tap();
    expect(panda.played).toEqual(['joy']);
    expect(panda.model.currentMove(panda.now)).toBe('joy');
  });

  it('ťuknutí během radosti radost nepřeruší ani nezačne znovu, tón zazní pokaždé', () => {
    const panda = new TestPanda();
    panda.tap();
    panda.wait(500);
    const before = panda.model.frame(panda.now);
    panda.tap();
    expect(panda.played).toEqual(['joy']);
    expect(panda.model.frame(panda.now)).toEqual(before);

    const finger = ipadMenu();
    finger.tap(pandaCenter(finger));
    finger.tap(pandaCenter(finger));
    expect(soundsOf(finger.feedback)).toEqual(['press', 'press']);
  });

  it('ťuknutí během pozdravu pozdrav ukončí a zahraje radost', () => {
    const panda = new TestPanda();
    panda.shown('opened');
    panda.wait(500);
    panda.tap();
    expect(panda.played).toEqual(['wave', 'joy']);
    panda.wait(moveDurationMs() + 1000);
    expect(panda.played).toEqual(['wave', 'joy']);
    expect(panda.model.currentMove(panda.now)).toBe('idle');
  });

  it('po doběhnutí radosti další ťuknutí zahraje radost znovu', () => {
    const panda = new TestPanda();
    panda.tap();
    panda.wait(moveDurationMs() + 100);
    panda.tap();
    expect(panda.played).toEqual(['joy', 'joy']);
  });

  it('ťuknutí na pandu během stahování hry spuštění zruší jako ťuknutí jinam', async () => {
    const menu = testMenu();
    menu.menu.tapTile('zebra');
    menu.menu.tapMascot();
    menu.download.succeed();
    await Promise.resolve();
    await Promise.resolve();
    expect(menu.game.started).toEqual([]);
    expect(menu.kinds()).toEqual(['press', 'mascot']);
  });
});

describe('#168 AC5: s otevřenou nabídkou je panda pod ní a nereaguje', () => {
  it('panda se kreslí pod nabídkou jazyků i seznamem kategorií', () => {
    const pandaLayer = MENU_LAYERS.indexOf('mascot');
    expect(pandaLayer).toBeGreaterThanOrEqual(0);
    for (const layer of ['languagePanel', 'languageList', 'pickerPanel', 'pickerList'] as const) {
      expect(MENU_LAYERS.indexOf(layer), layer).toBeGreaterThan(pandaLayer);
    }
  });

  it('s otevřenou nabídkou jazyků ťuknutí na pandu jen nabídku zavře', () => {
    const finger = ipadMenu();
    finger.tap(centerOf(finger.layout().languageSlot));
    expect(finger.menu.isLanguageMenuOpen()).toBe(true);
    finger.tap(pandaCenter(finger));
    expect(finger.menu.isLanguageMenuOpen()).toBe(false);
    expect(mascotTaps(finger.feedback)).toBe(0);
  });

  it('s otevřeným seznamem kategorií ťuknutí na pandu jen seznam zavře', () => {
    const finger = ipadMenu('375×1180');
    const picker = finger.layout().categoryPicker;
    expect(picker).not.toBeNull();
    finger.tap(centerOf(picker?.button ?? { left: 0, right: 0, top: 0, bottom: 0 }));
    expect(finger.menu.isCategoryMenuOpen()).toBe(true);
    finger.tap(pandaCenter(finger));
    expect(finger.menu.isCategoryMenuOpen()).toBe(false);
    expect(mascotTaps(finger.feedback)).toBe(0);
  });

  it('ťuknutí na pandu s otevřenou nabídkou nic nezahraje ani v logice menu', () => {
    const menu = testMenu();
    menu.menu.tapLanguageButton();
    menu.menu.tapMascot();
    expect(menu.kinds()).toEqual(['languageMenu', 'languageMenu']);
    expect(menu.menu.isLanguageMenuOpen()).toBe(false);
  });
});
