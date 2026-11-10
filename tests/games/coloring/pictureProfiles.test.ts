import { describe, expect, it } from 'vitest';

import { COLORING_META } from '../../../src/games/coloring/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #92 AC2 (každý profil má vlastní obrázek) a AC5 (nepodařené
 * uložení). Úložiště hry podle profilu dává hře stránka
 * (`store.gameStorage(COLORING_META.id)`, #71). Plné úložiště je
 * `DeviceStorage.failWrite`, zakázané `forbiddenStorage()`.
 */

const ORANGE = 1;
const GREEN = 3;
const BLUE = 4;

/** Zápis klíče Omalovánek selže (plné úložiště), ostatní klíče projdou. */
function failColoringWrites(storage: DeviceStorage): void {
  storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
}

describe('#92 AC2: každý profil má vlastní obrázek', () => {
  it('jiný profil začíná s prázdnou omalovánkou a první barvou', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const first = enterColoring(store, regions);
    first.tapColor(BLUE);
    paint(first, [at(20, 100), at(140, 100)]);
    first.suspend();

    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    store.selectProfile(second.id);
    const fresh = enterColoring(store, regions);

    expect(paintedPixels(fresh, regions)).toBe(0);
    expect(fresh.palette().selected).toBe(0);
  });

  it('malování jiného profilu nezmění obrázek prvního profilu ani po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    firstGame.tapColor(ORANGE);
    paint(firstGame, [at(20, 100), at(140, 100)]);
    const firstPicture = pixelsOf(firstGame, regions);
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    secondGame.tapColor(GREEN);
    paint(secondGame, [at(170, 20), at(290, 180)]);
    const secondPicture = pixelsOf(secondGame, regions);
    secondGame.suspend();

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    const firstAgain = enterColoring(reloaded, regions);
    expect(pixelsOf(firstAgain, regions), 'obrázek prvního profilu').toEqual(firstPicture);
    expect(firstAgain.palette().selected).toBe(ORANGE);
    firstAgain.suspend();

    reloaded.selectProfile(second.id);
    const secondAgain = enterColoring(reloaded, regions);
    expect(pixelsOf(secondAgain, regions), 'obrázek druhého profilu').toEqual(secondPicture);
    expect(secondAgain.palette().selected).toBe(GREEN);
  });

  it('smazaný a znovu založený profil se stejnou přezdívkou a barvou začíná prázdný', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    const game = enterColoring(store, regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);

    const fresh = enterColoring(store, regions);
    expect(paintedPixels(fresh, regions)).toBe(0);
    expect(fresh.palette().selected).toBe(0);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(again.id);
    const afterReload = enterColoring(reloaded, regions);
    expect(paintedPixels(afterReload, regions), 'ani po obnovení stránky').toBe(0);
    expect(afterReload.palette().selected).toBe(0);
  });
});

describe('#92 AC5: nepodařené uložení hru nezastaví', () => {
  it('při plném úložišti jde malovat dál bez chyby', () => {
    const storage = new DeviceStorage();
    failColoringWrites(storage);
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);

    expect(() => {
      paint(game, [at(20, 100), at(140, 100)]);
      game.tapColor(BLUE);
      paint(game, [at(200, 50), at(260, 50)]);
      game.suspend();
    }).not.toThrow();
    expect(game.colorAt(230, 50)).toBe(BLUE);
  });

  it('při zakázaném úložišti hra otevře prázdnou omalovánku a jde malovat bez chyby', () => {
    const regions = twoHalves();
    const game = enterColoring(openProfiles(forbiddenStorage()), regions);
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.palette().selected).toBe(0);

    expect(() => {
      paint(game, [at(20, 100), at(140, 100)]);
      game.suspend();
    }).not.toThrow();
    expect(game.colorAt(80, 100)).toBe(0);
  });

  it('úložiště, které při zápisu i čtení vyhodí chybu, hru nezastaví', () => {
    const storage = new RecordingStorage();
    storage.failReads = true;
    storage.failWrites = true;
    const regions = twoHalves();

    expect(() => {
      const game = openOn(storage, regions);
      paint(game, [at(20, 100), at(140, 100)]);
      game.interrupt();
      game.suspend();
    }).not.toThrow();
  });

  it('bez úložiště od stránky (hra spuštěná jinak než z menu) jde malovat bez chyby', () => {
    const regions = twoHalves();
    expect(() => {
      const game = openOn(undefined, regions);
      paint(game, [at(20, 100), at(140, 100)]);
      game.suspend();
    }).not.toThrow();
  });

  it('po nepodařeném uložení, návratu domečkem a novém otevření je obrázek stejný jako před odchodem', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    failColoringWrites(storage);
    const game = enterColoring(store, regions);
    game.tapColor(ORANGE);
    paint(game, [at(20, 100), at(140, 100)]);
    const before = pixelsOf(game, regions);
    game.suspend();

    const again = enterColoring(store, regions);
    expect(pixelsOf(again, regions)).toEqual(before);
    expect(again.palette().selected).toBe(ORANGE);
  });

  it('po obnovení stránky se ukáže naposledy úspěšně uložený obrázek', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(GREEN);
    paint(game, [at(20, 100), at(140, 100)]);
    const saved = pixelsOf(game, regions);

    failColoringWrites(storage);
    game.tapColor(BLUE);
    paint(game, [at(200, 50), at(260, 50)]);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reloaded, regions)).toEqual(saved);
    expect(reloaded.palette().selected).toBe(GREEN);
  });

  it('po obnovení stránky je prázdná omalovánka, když se žádné uložení nepodařilo', () => {
    const storage = new DeviceStorage();
    failColoringWrites(storage);
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(paintedPixels(reloaded, regions)).toBe(0);
    expect(reloaded.palette().selected).toBe(0);
  });
});
