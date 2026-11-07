import { describe, expect, it } from 'vitest';

import { encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #96 AC2 (úchyt otevře a zavře panel, první otevření podle
 * profilu), AC3 (výběr barvy a Zpět panel nezmění), AC4 (tah při
 * otevřeném panelu) a AC5 (úchyt ukazuje výběr). Rozložení a to, kam
 * dotyk patří (panel, nebo obrázek), jsou v `toolPanelLayoutRules.test.ts`.
 *
 * Jedno „otevření hry“ je `openColoring(…)` nad úložištěm hry aktivního
 * profilu, jedno „obnovení stránky“ je nové `openProfiles(storage)` nad
 * stejným úložištěm zařízení (`savedPictureHelpers.ts`, #92). Ťuknutí na
 * úchyt hlásí scéna jako `game.tapHandle()`, dotyk na obrázku jako
 * `pointerDown` (scéna ho tam pošle jen u `touchTargetAt(…).kind === 'picture'`).
 * Schování stránky hlásí scéna jako `suspend()`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/savedPicture.ts`, nová pole
 * `SavedColoring`):
 * - `panelOpen(): boolean` je panel nástrojů otevřený?
 * - `tapHandle(): readonly Tone[]` ťuknutí na úchyt: přepne panel a vrátí
 *   tón; během tahu se nepočítá a vrátí `[]`,
 * - `pointerDown` na obrázku otevřený panel zavře a zároveň maluje,
 * - `handleView(): HandleView` co ukazuje úchyt,
 *   `HandleView = { readonly tool: ToolId; readonly color: number | null }`,
 *   `ToolId = 'brush'` (další nástroje přidají navazující úkoly, guma
 *   s `color: null` od #90).
 * Záznam o prvním otevření leží v úložišti hry profilu vedle obrázku.
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

/** Klíč záznamu obrázku z #92 v úložišti hry (dřívější verze, bez záznamu o panelu). */
const OLD_PICTURE_KEY = `picture.${PICTURE.id}`;

describe('#96 AC2: úchyt otevře a zavře panel', () => {
  it('ťuknutí na úchyt panel otevře, další ťuknutí ho zavře, pokaždé s tónem kratším než 1 s', () => {
    const storage = new RecordingStorage();
    openOn(storage, twoHalves()).suspend();
    const game = openOn(storage, twoHalves());
    expect(game.panelOpen(), 'podruhé začíná zavřený').toBe(false);

    const openTones = game.tapHandle();
    expect(game.panelOpen(), 'po prvním ťuknutí').toBe(true);
    const closeTones = game.tapHandle();
    expect(game.panelOpen(), 'po druhém ťuknutí').toBe(false);

    for (const tones of [openTones, closeTones]) {
      expect(tones.length).toBeGreaterThan(0);
      expect(endOf(tones)).toBeLessThan(1);
    }
  });

  it('při úplně prvním otevření Omalovánek v profilu je panel otevřený', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.panelOpen()).toBe(true);
  });

  it('po návratu z menu začíná panel zavřený, i když ho dítě nechalo otevřený', () => {
    const storage = new RecordingStorage();
    const first = openOn(storage, twoHalves());
    expect(first.panelOpen()).toBe(true);
    first.suspend();

    expect(openOn(storage, twoHalves()).panelOpen()).toBe(false);
  });

  it('po obnovení stránky začíná panel zavřený', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    enterColoring(openProfiles(storage), regions).suspend();

    const reloaded = openProfiles(storage);
    expect(enterColoring(reloaded, regions).panelOpen()).toBe(false);
  });

  it('nový profil uvidí při prvním otevření panel otevřený, profil, který už Omalovánky otevřel, zavřený', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const first = store.activeProfile();
    enterColoring(store, regions).suspend();

    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(secondGame.panelOpen(), 'druhý profil poprvé').toBe(true);
    secondGame.suspend();

    store.selectProfile(first.id);
    expect(enterColoring(store, regions).panelOpen(), 'první profil znovu').toBe(false);
    store.selectProfile(second.id);
    expect(enterColoring(store, regions).panelOpen(), 'druhý profil znovu').toBe(false);
  });

  it('nesmyslný záznam o prvním otevření se bere jako první otevření a hra se nezastaví', () => {
    for (const nonsense of ['', 'nesmysl', '{', 'null', '42', '-1', 'true false']) {
      const storage = new RecordingStorage();
      openOn(storage, twoHalves()).suspend();
      storage.rewriteAll(() => nonsense);

      let game: ReturnType<typeof openOn> | undefined;
      expect(() => {
        game = openOn(storage, twoHalves());
      }, `záznam „${nonsense}“`).not.toThrow();
      expect(game?.panelOpen(), `záznam „${nonsense}“`).toBe(true);
    }
  });

  it('nečitelné úložiště se bere jako první otevření a hra se nezastaví', () => {
    const store = openProfiles(forbiddenStorage());
    const game = enterColoring(store, twoHalves());
    expect(game.panelOpen()).toBe(true);
    expect(() => game.tapHandle()).not.toThrow();
  });

  it('profil s obrázkem uloženým před tímto úkolem uvidí otevřený panel jednou a obrázek zůstane', () => {
    const regions = twoHalves();
    const before = openOn(new RecordingStorage(), regions);
    before.tapColor(BLUE);
    paint(before, [at(20, 100), at(140, 100)]);
    const picture = pixelsOf(before, regions);

    const storage = new RecordingStorage();
    storage.setItem(
      OLD_PICTURE_KEY,
      encodePicture({ picture: PICTURE, regions, colors: before, selectedColor: BLUE }),
    );

    const first = openOn(storage, regions);
    expect(first.panelOpen(), 'poprvé po aktualizaci').toBe(true);
    expect(pixelsOf(first, regions), 'obrázek beze změny').toEqual(picture);
    first.suspend();

    const second = openOn(storage, regions);
    expect(second.panelOpen(), 'podruhé po aktualizaci').toBe(false);
    expect(pixelsOf(second, regions), 'obrázek beze změny').toEqual(picture);
  });

  it('po schování stránky zůstane otevřený panel otevřený a zavřený zavřený', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    expect(game.panelOpen()).toBe(true);
    game.suspend();
    expect(game.panelOpen(), 'otevřený po schování').toBe(true);

    game.tapHandle();
    expect(game.panelOpen()).toBe(false);
    game.suspend();
    expect(game.panelOpen(), 'zavřený po schování').toBe(false);
  });

  it('ťuknutí na úchyt druhým prstem během tahu se nepočítá a tah pokračuje', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    openOn(storage, regions).suspend();
    const game = openOn(storage, regions);
    expect(game.panelOpen()).toBe(false);

    startStroke(game, [at(20, 40), at(60, 40)]);
    const painted = paintedPixels(game, regions);
    const tones = game.tapHandle();

    expect(tones, 'během tahu žádný tón').toEqual([]);
    expect(game.panelOpen(), 'panel se během tahu neotevře').toBe(false);
    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(paintedPixels(game, regions), 'tah pokračoval').toBeGreaterThan(painted);
    expect(game.colorAt(130, 40), 'konec tahu je namalovaný').toBe(RED);
  });

  it('po skončení tahu jde úchytem panel zase otevřít', () => {
    const storage = new RecordingStorage();
    openOn(storage, twoHalves()).suspend();
    const game = openOn(storage, twoHalves());
    paint(game, [at(20, 40), at(60, 40)]);

    game.tapHandle();
    expect(game.panelOpen()).toBe(true);
  });
});

describe('#96 AC3: výběr barvy a Zpět panel nezmění', () => {
  it('výběr barvy v otevřeném panelu barvu vybere a panel zůstane otevřený', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.panelOpen()).toBe(true);

    const tones = game.tapColor(BLUE);

    expect(game.palette().selected).toBe(BLUE);
    expect(tones.length).toBeGreaterThan(0);
    expect(game.panelOpen()).toBe(true);
  });

  it('Zpět při otevřeném panelu vrátí tah a panel zůstane otevřený', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapHandle();
    expect(game.panelOpen()).toBe(true);

    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.panelOpen()).toBe(true);
  });

  it('Zpět při zavřeném panelu vrátí tah a panel zůstane zavřený', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(140, 100)]);
    expect(game.panelOpen()).toBe(false);

    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.panelOpen()).toBe(false);
  });

  it('Zpět bez tahu se jen zhoupne a stav panelu nezmění', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.tapUndo().kind).toBe('wobble');
    expect(game.panelOpen()).toBe(true);
  });
});

describe('#96 AC4: tah při otevřeném panelu', () => {
  it('tah začatý na obrázku otevřený panel zavře a zároveň normálně maluje', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    expect(game.panelOpen()).toBe(true);

    const changed = game.pointerDown({ id: 1, x: 20, y: 100, kind: 'touch' });
    expect(game.panelOpen(), 'panel se zavře hned při dotyku').toBe(false);
    expect(changed, 'první dotyk už maluje').not.toBeNull();
    game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
    game.pointerUp(1);

    expect(game.colorAt(20, 100)).toBe(RED);
    expect(game.colorAt(140, 100)).toBe(RED);
  });

  it('ťuknutí na obrázek při otevřeném panelu udělá tečku a tu jde vrátit Zpět', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    expect(game.panelOpen()).toBe(true);

    paint(game, [at(70, 100)]);
    expect(game.colorAt(70, 100), 'tečka').toBe(RED);
    expect(game.panelOpen()).toBe(false);

    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'tečka je pryč').toBe(0);
  });

  it('domeček funguje i při otevřeném panelu: odchod uloží obrázek', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLACK);
    expect(game.panelOpen()).toBe(true);

    game.suspend();

    const again = openOn(storage, regions);
    expect(again.palette().selected).toBe(BLACK);
  });
});

describe('#96 AC5: úchyt ukazuje vybraný nástroj ve vybrané barvě', () => {
  it('na začátku úchyt ukazuje štětec v první barvě', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: RED });
  });

  it('po každé změně barvy úchyt hned ukazuje novou barvu, i se zavřeným panelem', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    for (const color of [BLUE, BLACK, RED, BLUE]) {
      game.tapColor(color);
      expect(game.handleView(), `barva ${color}`).toMatchObject({ tool: 'brush', color });
    }
    game.tapHandle();
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });

  it('po návratu do hry úchyt ukazuje naposledy vybranou barvu', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    game.tapColor(BLACK);
    game.suspend();

    expect(openOn(storage, twoHalves()).handleView()).toMatchObject({
      tool: 'brush',
      color: BLACK,
    });
  });

  it('neplatná barva úchyt nezmění', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(BLUE);
    game.tapColor(99);
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });
});
