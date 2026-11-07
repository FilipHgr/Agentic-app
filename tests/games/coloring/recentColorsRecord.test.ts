import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';
import {
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import {
  BLACK,
  BLUE,
  GREEN,
  ORANGE,
  PALETTE_SIZE,
  PURPLE,
  RED,
  YELLOW,
  choiceOf,
  pick,
  seededRandom,
  visibleColors,
} from './recentColorsHelpers';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #99 AC5 (nedávné barvy se pamatují podle profilu stejně jako
 * vybraná barva, #92). Jedno „otevření hry“ je `openColoring(…)` nad
 * úložištěm hry profilu, „obnovení stránky“ nové `openProfiles(storage)`
 * nad stejným úložištěm zařízení (`savedPictureHelpers.ts`).
 *
 * Podle zadání se nedávné barvy ukládají v samostatném záznamu vedle
 * obrázku, aby záznam obrázku (p1, p2) zůstal beze změny. Testy proto
 * nehledají konkrétní klíč: záznam nedávných barev je ten, který se změní
 * výběrem barvy a není to záznam obrázku.
 *
 * Navržené rozhraní: viz `recentColors.test.ts` (`recentColors()`,
 * `tapRecentColor(index)`). Záznam se zapíše hned po výběru barvy, stejně
 * jako vybraná barva (#92), chybějící, nesmyslný nebo nečitelný záznam dá
 * dvě prázdná místa.
 */

/**
 * Úložiště s rozmalovaným obrázkem a nedávnými barvami [modrá, červená]
 * při vybrané zelené. Vrátí i klíče záznamu nedávných barev.
 */
function storageWithRecents(regions: RegionMap): {
  storage: RecordingStorage;
  recentKeys: string[];
  picture: Array<number | null>;
} {
  const storage = new RecordingStorage();
  const game = openOn(storage, regions);
  game.tapColor(BLUE);
  paint(game, [at(20, 100), at(140, 100)]);
  const before = new Map(storage.data);
  game.tapColor(GREEN);
  expect(choiceOf(game), 'připravený stav').toEqual({ selected: GREEN, recent: [BLUE, RED] });
  const changed = storage.keys().filter((key) => storage.data.get(key) !== before.get(key));
  const recentKeys = changed.filter((key) => {
    const value = storage.data.get(key) ?? '';
    return decodePicture(value, PICTURE, regions) === null;
  });
  return { storage, recentKeys, picture: pixelsOf(game, regions) };
}

function copyOf(storage: RecordingStorage): RecordingStorage {
  const copy = new RecordingStorage();
  for (const [key, value] of storage.data) {
    copy.data.set(key, value);
  }
  return copy;
}

describe('#99 AC5: nedávné barvy se pamatují podle profilu', () => {
  it('po návratu z menu jsou nedávné barvy stejné jako při odchodu', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    game.tapColor(BLUE);
    game.tapColor(YELLOW);
    game.tapRecentColor(0);
    const before = choiceOf(game);
    game.suspend();

    const again = enterColoring(store, regions);

    expect(choiceOf(again)).toEqual(before);
  });

  it('výběr barvy nedávné barvy uloží hned, bez tahu a bez odchodu ze hry', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(ORANGE);
    game.tapColor(PURPLE);

    const again = openOn(storage, regions);

    expect(choiceOf(again)).toEqual({ selected: PURPLE, recent: [ORANGE, RED] });
  });

  it('výběr nedávné barvy v pruhu se uloží hned', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(ORANGE);
    game.tapColor(PURPLE);
    game.tapRecentColor(1);

    const again = openOn(storage, regions);

    expect(choiceOf(again)).toEqual({ selected: RED, recent: [PURPLE, ORANGE] });
  });

  it('po obnovení stránky jsou nedávné barvy stejné a dál platí pořadí', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(BLUE);
    game.tapColor(BLACK);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(choiceOf(reloaded), 'po obnovení').toEqual({ selected: BLACK, recent: [BLUE, RED] });

    reloaded.tapRecentColor(1);
    expect(choiceOf(reloaded), 'po výběru v pruhu').toEqual({
      selected: RED,
      recent: [BLACK, BLUE],
    });
  });

  it('jiný profil začíná s prázdnými místy a jeho výběr nezmění nedávné barvy prvního', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    firstGame.tapColor(BLUE);
    firstGame.tapColor(YELLOW);
    const firstChoice = choiceOf(firstGame);
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(secondGame.recentColors(), 'druhý profil začíná prázdný').toEqual([null, null]);
    secondGame.tapColor(BLACK);
    secondGame.tapColor(ORANGE);
    const secondChoice = choiceOf(secondGame);
    secondGame.suspend();

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(choiceOf(enterColoring(reloaded, regions)), 'první profil').toEqual(firstChoice);
    reloaded.selectProfile(second.id);
    expect(choiceOf(enterColoring(reloaded, regions)), 'druhý profil').toEqual(secondChoice);
  });

  it('smazaný a znovu založený profil začíná s prázdnými místy, i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    const game = enterColoring(store, regions);
    game.tapColor(BLUE);
    game.tapColor(GREEN);
    game.suspend();

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);

    expect(enterColoring(store, regions).recentColors()).toEqual([null, null]);
    const reloaded = openProfiles(storage);
    reloaded.selectProfile(again.id);
    expect(enterColoring(reloaded, regions).recentColors(), 'po obnovení').toEqual([null, null]);
  });

  it('nedávné barvy jsou v samostatném záznamu a záznam obrázku se nezmění', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapColor(GREEN);
    game.suspend();

    const pictureRecord = encodePicture({
      picture: PICTURE,
      regions,
      colors: game,
      selectedColor: GREEN,
    });
    const records = [...storage.data.values()];
    expect(records, 'záznam obrázku je stejný jako bez nedávných barev').toContain(pictureRecord);
    const pictures = records.filter((record) => decodePicture(record, PICTURE, regions) !== null);
    expect(pictures.length, 'jen jeden záznam obrázku').toBe(1);
  });
});

describe('#99 AC5: chybějící nebo nesmyslný záznam dá prázdná místa', () => {
  it('výběr barvy zapíše záznam nedávných barev vedle obrázku', () => {
    const { recentKeys } = storageWithRecents(twoHalves());
    expect(recentKeys.length).toBeGreaterThan(0);
  });

  it('smazaný záznam nedávných barev dá prázdná místa a obrázek i barva zůstanou', () => {
    const regions = twoHalves();
    const { storage, recentKeys, picture } = storageWithRecents(regions);
    expect(recentKeys.length, 'záznam nedávných barev se zapsal').toBeGreaterThan(0);
    for (const key of recentKeys) {
      storage.data.delete(key);
    }

    const game = openOn(storage, regions);

    expect(game.recentColors()).toEqual([null, null]);
    expect(game.palette().selected, 'vybraná barva').toBe(GREEN);
    expect(pixelsOf(game, regions), 'obrázek').toEqual(picture);
  });

  it('nesmyslný záznam dá prázdná místa, hra se nezastaví a jde vybírat dál', () => {
    const regions = twoHalves();
    const { storage, recentKeys, picture } = storageWithRecents(regions);
    expect(recentKeys.length, 'záznam nedávných barev se zapsal').toBeGreaterThan(0);
    const nonsense = [
      '',
      'nesmysl',
      'null',
      'undefined',
      '{}',
      '{"recent":"modrá"}',
      '-1',
      '99',
      '[99,99]',
      '[-1,-2]',
      '[1.5,2.5]',
      '["blue","red"]',
      '\u0000\u0001',
      'x'.repeat(10_000),
    ];
    for (const text of nonsense) {
      const broken = copyOf(storage);
      for (const key of recentKeys) {
        broken.data.set(key, text);
      }
      const what = `záznam ${JSON.stringify(text.slice(0, 20))}`;
      expect(() => {
        const game = openOn(broken, regions);
        expect(game.recentColors(), what).toEqual([null, null]);
        expect(game.palette().selected, `${what}: vybraná barva`).toBe(GREEN);
        expect(pixelsOf(game, regions), `${what}: obrázek`).toEqual(picture);
        game.tapColor(ORANGE);
        expect(choiceOf(game), `${what}: výběr po něm`).toEqual({
          selected: ORANGE,
          recent: [GREEN, null],
        });
      }, `${what}: hra se nezastaví`).not.toThrow();
    }
  });

  it('jakkoli poškozený záznam nikdy neukáže barvu dvakrát ani barvu mimo paletu', () => {
    const regions = twoHalves();
    const { storage, recentKeys } = storageWithRecents(regions);
    expect(recentKeys.length, 'záznam nedávných barev se zapsal').toBeGreaterThan(0);
    const original = storage.data.get(recentKeys[0] ?? '') ?? '';
    const random = seededRandom(9901);
    const alphabet = '0123456789,[]|{}":-.abc ';
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const characters = [...original];
      const changes = 1 + pick(random, 3);
      for (let change = 0; change < changes; change += 1) {
        const position = pick(random, characters.length + 1);
        characters.splice(position, 1, alphabet[pick(random, alphabet.length)] ?? '');
      }
      const text = characters.join('');
      const broken = copyOf(storage);
      for (const key of recentKeys) {
        broken.data.set(key, text);
      }
      const what = `pokus ${attempt + 1}: ${JSON.stringify(text)}`;
      let visible: number[] = [];
      let recent: readonly (number | null)[] = [];
      expect(() => {
        const game = openOn(broken, regions);
        recent = game.recentColors();
        visible = visibleColors(choiceOf(game));
      }, `${what}: hra se nezastaví`).not.toThrow();
      expect(recent.length, `${what}: dvě místa`).toBe(2);
      expect(new Set(visible).size, `${what}: žádná barva dvakrát`).toBe(visible.length);
      for (const color of visible) {
        expect(
          Number.isInteger(color) && color >= 0 && color < PALETTE_SIZE,
          `${what}: barva ${color}`,
        ).toBe(true);
      }
    }
  });

  it('nečitelné úložiště dá prázdná místa a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage } = storageWithRecents(regions);
    storage.failReads = true;

    let recent: readonly (number | null)[] = [];
    expect(() => {
      recent = openOn(storage, regions).recentColors();
    }).not.toThrow();
    expect(recent).toEqual([null, null]);
  });

  it('zakázané úložiště dá prázdná místa a nedávné barvy fungují aspoň do odchodu', () => {
    const regions = twoHalves();
    expect(() => {
      const game = enterColoring(openProfiles(forbiddenStorage()), regions);
      expect(game.recentColors()).toEqual([null, null]);
      game.tapColor(BLUE);
      game.tapRecentColor(0);
      expect(choiceOf(game)).toEqual({ selected: RED, recent: [BLUE, null] });
      game.suspend();
    }).not.toThrow();
  });

  it('při plném úložišti jde nedávné barvy vybírat dál bez chyby', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    storage.failWrites = true;

    expect(() => {
      game.tapColor(BLUE);
      game.tapColor(YELLOW);
      game.tapRecentColor(0);
    }).not.toThrow();
    expect(choiceOf(game)).toEqual({ selected: BLUE, recent: [YELLOW, RED] });
  });
});

describe('#99 AC5: obrázky uložené před tímto úkolem', () => {
  it('obrázek p2 uložený bez nedávných barev se otevře beze změny s prázdnými místy', () => {
    const regions = twoHalves();
    const painter = openOn(new RecordingStorage(), regions);
    painter.tapColor(BLACK);
    paint(painter, [at(20, 100), at(140, 100)]);
    const record = encodePicture({
      picture: PICTURE,
      regions,
      colors: painter,
      selectedColor: BLACK,
    });
    const storage = new RecordingStorage();
    const opener = openOn(storage, regions);
    opener.tapColor(BLUE);
    opener.suspend();
    // Jen starý záznam obrázku, bez záznamu nedávných barev.
    const pictureKeys = storage
      .keys()
      .filter((key) => decodePicture(storage.data.get(key) ?? '', PICTURE, regions) !== null);
    storage.data.clear();
    for (const key of pictureKeys) {
      storage.data.set(key, record);
    }

    const game = openOn(storage, regions);

    expect(pixelsOf(game, regions), 'obrázek').toEqual(pixelsOf(painter, regions));
    expect(choiceOf(game)).toEqual({ selected: BLACK, recent: [null, null] });
  });

  it('starý záznam p1 se otevře beze změny pixel po pixelu s prázdnými místy', () => {
    const regions = legacyRegions();
    const storage = new RecordingStorage();
    const opener = openOn(storage, regions);
    opener.tapColor(BLUE);
    opener.suspend();
    const pictureKeys = storage
      .keys()
      .filter((key) => decodePicture(storage.data.get(key) ?? '', PICTURE, regions) !== null);
    storage.data.clear();
    for (const key of pictureKeys) {
      storage.data.set(key, LEGACY_P1_RECORD);
    }

    const game = openOn(storage, regions);

    expect(pixelsOf(game, regions), 'starý obrázek').toEqual(legacyPixels());
    expect(choiceOf(game)).toEqual({ selected: LEGACY_SELECTED_COLOR, recent: [null, null] });
  });
});
