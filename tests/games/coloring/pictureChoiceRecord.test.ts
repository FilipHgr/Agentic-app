import { describe, expect, it } from 'vitest';

import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  LEGACY_P4_RECENT_COLORS,
  LEGACY_P4_SELECTED_COLOR,
  LEGACY_P4_STORAGE,
  LEGACY_P4_TOOL_COLORS,
  legacyP4Pixels,
  legacyP4Regions,
} from './legacyP4RecordFixture';
import {
  THREE_PICTURES,
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
} from './pictureChoiceHelpers';
import { paint, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import {
  BLUE,
  COLOR_TOOLS,
  DEFAULT_TOOL_COLORS,
  GREEN,
  ORANGE,
  PURPLE,
  giveColor,
  toolColorsOf,
} from './toolColorsHelpers';

/**
 * Testy k #124 AC2 (každá omalovánka má svůj obrázek podle profilu)
 * a AC5 (nepodařené uložení platí pro každou omalovánku zvlášť, jako
 * #92 AC5). Dítě omalovánky otevírá z výběru (`openFromPicker`) a vrací se
 * domečkem (`backToPicker`). Obnovení stránky je nové `openProfiles` nad
 * stejným úložištěm zařízení. Test nezná klíče záznamů kromě dnešního
 * formátu domku z AC2 (`picture.house`, `toolColors.house`,
 * `recentColors.house` v pevném záznamu `legacyP4RecordFixture.ts`).
 */

/** Vybraná barva nové omalovánky (štětec ve výchozí barvě). */
const FIRST_COLOR = DEFAULT_TOOL_COLORS.brush;

/** Zápis klíčů Omalovánek selže (plné úložiště), ostatní klíče projdou. */
function failColoringWrites(storage: DeviceStorage): void {
  storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
}

/** Dítě otevře omalovánku `index` z nového výběru (po obnovení stránky nebo z menu). */
function openPicture(store: ProfileStore, index: number) {
  return openFromPicker(enterPicker(THREE_PICTURES), index, coloringStorage(store), twoHalves());
}

describe('#124 AC2: každá omalovánka má svůj obrázek', () => {
  it('dítě rozmaluje omalovánku A, vrátí se na výběr a otevře B: B začíná prázdná s první barvou', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const pictureA = openFromPicker(choice, 0, coloringStorage(store), regions);
    pictureA.tapColor(BLUE);
    paint(pictureA, [at(20, 100), at(140, 100)]);
    backToPicker(choice, pictureA);

    const pictureB = openFromPicker(choice, 1, coloringStorage(store), regions);
    expect(paintedPixels(pictureB, regions), 'nová omalovánka B').toBe(0);
    expect(pictureB.palette().selected, 'první barva').toBe(FIRST_COLOR);
  });

  it('rozmalovaná B má po návratu svůj stav a malování B nezmění A', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const pictureA = openFromPicker(choice, 0, coloringStorage(store), regions);
    pictureA.tapColor(BLUE);
    paint(pictureA, [at(20, 100), at(140, 100)]);
    const pixelsA = pixelsOf(pictureA, regions);
    backToPicker(choice, pictureA);

    const pictureB = openFromPicker(choice, 1, coloringStorage(store), regions);
    pictureB.tapColor(GREEN);
    paint(pictureB, [at(170, 20), at(290, 180)]);
    const pixelsB = pixelsOf(pictureB, regions);
    backToPicker(choice, pictureB);

    const againA = openFromPicker(choice, 0, coloringStorage(store), regions);
    expect(pixelsOf(againA, regions), 'A').toEqual(pixelsA);
    expect(againA.palette().selected, 'barva A').toBe(BLUE);
    backToPicker(choice, againA);
    const againB = openFromPicker(choice, 1, coloringStorage(store), regions);
    expect(pixelsOf(againB, regions), 'B').toEqual(pixelsB);
    expect(againB.palette().selected, 'barva B').toBe(GREEN);
  });

  it('po návratu k A je A stejná pixel po pixelu i po obnovení stránky, se stejnou barvou, barvami nástrojů a nedávnými barvami', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const pictureA = openFromPicker(choice, 2, coloringStorage(store), regions);
    giveColor(pictureA, 'marker', PURPLE);
    paint(pictureA, [at(20, 30), at(140, 30)]);
    giveColor(pictureA, 'brush', ORANGE);
    paint(pictureA, [at(20, 120), at(140, 160)]);
    const pixels = pixelsOf(pictureA, regions);
    const selected = pictureA.palette().selected;
    const toolColors = toolColorsOf(pictureA);
    const recent = pictureA.recentColors();
    backToPicker(choice, pictureA);

    const otherPicture = openFromPicker(choice, 0, coloringStorage(store), regions);
    paint(otherPicture, [at(200, 100), at(280, 100)]);
    backToPicker(choice, otherPicture);

    const reloaded = openPicture(openProfiles(device), 2);
    expect(pixelsOf(reloaded, regions), 'obrázek').toEqual(pixels);
    expect(reloaded.palette().selected, 'vybraná barva').toBe(selected);
    expect(toolColorsOf(reloaded), 'barvy nástrojů').toEqual(toolColors);
    expect(reloaded.recentColors(), 'nedávné barvy').toEqual(recent);
  });

  it('barvy nástrojů a nedávné barvy se pamatují pro každou omalovánku zvlášť', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const pictureA = openFromPicker(choice, 0, coloringStorage(store), regions);
    giveColor(pictureA, 'marker', GREEN);
    giveColor(pictureA, 'brush', BLUE);
    const recentA = pictureA.recentColors();
    backToPicker(choice, pictureA);

    const pictureB = openFromPicker(choice, 1, coloringStorage(store), regions);
    expect(toolColorsOf(pictureB), 'B má výchozí barvy nástrojů').toEqual(DEFAULT_TOOL_COLORS);
    const freshRecent = openPicture(openProfiles(new DeviceStorage()), 1).recentColors();
    expect(recentA, 'A má nové nedávné barvy').not.toEqual(freshRecent);
    expect(pictureB.recentColors(), 'B má nedávné barvy nové omalovánky').toEqual(freshRecent);
    giveColor(pictureB, 'brush', PURPLE);
    backToPicker(choice, pictureB);

    const reloadedA = openPicture(openProfiles(device), 0);
    expect(reloadedA.toolColor('marker'), 'fix v A').toBe(GREEN);
    expect(reloadedA.toolColor('brush'), 'štětec v A').toBe(BLUE);
    expect(reloadedA.recentColors(), 'nedávné barvy A').toEqual(recentA);
    const reloadedB = openPicture(openProfiles(device), 1);
    expect(reloadedB.toolColor('brush'), 'štětec v B').toBe(PURPLE);
    expect(reloadedB.toolColor('marker'), 'fix v B').toBe(DEFAULT_TOOL_COLORS.marker);
  });

  it('jiný profil má své stavy všech omalovánek', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstPixels = THREE_PICTURES.map((_, index) => {
      const game = openPicture(store, index);
      game.tapColor(index + 1);
      paint(game, [at(20, 40 + index * 50), at(140, 40 + index * 50)]);
      game.suspend();
      return pixelsOf(game, regions);
    });

    store.selectProfile(second.id);
    THREE_PICTURES.forEach((_, index) => {
      const game = openPicture(store, index);
      expect(paintedPixels(game, regions), `druhý profil, omalovánka ${index + 1}`).toBe(0);
      expect(game.palette().selected, `druhý profil, omalovánka ${index + 1}`).toBe(FIRST_COLOR);
      game.tapColor(PURPLE);
      paint(game, [at(170, 100), at(290, 100)]);
      game.suspend();
    });

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    THREE_PICTURES.forEach((_, index) => {
      const game = openPicture(reloaded, index);
      expect(pixelsOf(game, regions), `první profil, omalovánka ${index + 1}`).toEqual(
        firstPixels[index],
      );
      expect(game.palette().selected, `první profil, omalovánka ${index + 1}`).toBe(index + 1);
    });
  });

  it('pevný záznam domku dnešního formátu se po otevření domku z výběru ukáže pixel po pixelu stejně se stejnými barvami', () => {
    const device = new DeviceStorage();
    const gameStorage = coloringStorage(openProfiles(device));
    for (const [key, value] of LEGACY_P4_STORAGE) {
      gameStorage.setItem(key, value);
    }
    const houseIndex = COLORING_PICTURES.findIndex((picture) => picture.id === 'house');
    expect(COLORING_PICTURES[houseIndex], 'domek má dál označení house verze 1').toEqual({
      id: 'house',
      version: 1,
    });

    const regions = legacyP4Regions();
    const choice = enterPicker(COLORING_PICTURES);
    const house = openFromPicker(
      choice,
      houseIndex,
      coloringStorage(openProfiles(device)),
      regions,
    );

    expect(pixelsOf(house, regions), 'obrázek pixel po pixelu').toEqual(legacyP4Pixels());
    expect(house.palette().selected, 'vybraná barva').toBe(LEGACY_P4_SELECTED_COLOR);
    for (const tool of COLOR_TOOLS) {
      expect(house.toolColor(tool), `barva nástroje ${tool}`).toBe(LEGACY_P4_TOOL_COLORS[tool]);
    }
    expect(house.recentColors(), 'nedávné barvy').toEqual(LEGACY_P4_RECENT_COLORS);
  });

  it('pevný záznam domku se neukáže v jiné omalovánce sady', () => {
    const device = new DeviceStorage();
    const gameStorage = coloringStorage(openProfiles(device));
    for (const [key, value] of LEGACY_P4_STORAGE) {
      gameStorage.setItem(key, value);
    }
    const regions = legacyP4Regions();
    COLORING_PICTURES.forEach((picture, index) => {
      if (picture.id === 'house') {
        return;
      }
      const game = openFromPicker(
        enterPicker(COLORING_PICTURES),
        index,
        coloringStorage(openProfiles(device)),
        regions,
      );
      expect(paintedPixels(game, regions), `omalovánka ${picture.id}`).toBe(0);
      expect(toolColorsOf(game), `barvy nástrojů ${picture.id}`).toEqual(DEFAULT_TOOL_COLORS);
    });
  });
});

describe('#124 AC5: nepodařené uložení platí pro každou omalovánku zvlášť', () => {
  it('při plném úložišti jde malovat v každé omalovánce bez chyby a po návratu má každá svůj obrázek', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    failColoringWrites(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);

    const before: Array<Array<number | null>> = [];
    expect(() => {
      THREE_PICTURES.forEach((_, index) => {
        const game = openFromPicker(choice, index, coloringStorage(store), regions);
        game.tapColor(index + 2);
        paint(game, [at(20, 30 + index * 60), at(140, 30 + index * 60)]);
        before.push(pixelsOf(game, regions));
        backToPicker(choice, game);
      });
    }).not.toThrow();

    THREE_PICTURES.forEach((_, index) => {
      const game = openFromPicker(choice, index, coloringStorage(store), regions);
      expect(pixelsOf(game, regions), `omalovánka ${index + 1}`).toEqual(before[index]);
      expect(game.palette().selected, `omalovánka ${index + 1}`).toBe(index + 2);
      backToPicker(choice, game);
    });
  });

  it('po obnovení stránky má každá omalovánka naposledy úspěšně uložený obrázek', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);

    const saved = openFromPicker(choice, 0, coloringStorage(store), regions);
    saved.tapColor(GREEN);
    paint(saved, [at(20, 100), at(140, 100)]);
    const savedPixels = pixelsOf(saved, regions);
    backToPicker(choice, saved);

    failColoringWrites(device);
    const lost = openFromPicker(choice, 1, coloringStorage(store), regions);
    lost.tapColor(BLUE);
    paint(lost, [at(20, 100), at(140, 100)]);
    backToPicker(choice, lost);
    const again = openFromPicker(choice, 0, coloringStorage(store), regions);
    paint(again, [at(200, 50), at(260, 50)]);
    backToPicker(choice, again);

    const reloaded = openProfiles(device);
    const first = openPicture(reloaded, 0);
    expect(pixelsOf(first, regions), 'A: naposledy uložený obrázek').toEqual(savedPixels);
    expect(first.palette().selected, 'A: barva').toBe(GREEN);
    const second = openPicture(reloaded, 1);
    expect(paintedPixels(second, regions), 'B: nic se neuložilo').toBe(0);
    expect(second.palette().selected, 'B: první barva').toBe(FIRST_COLOR);
  });
});
