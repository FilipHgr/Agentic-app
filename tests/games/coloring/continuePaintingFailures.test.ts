import { afterEach, describe, expect, it, vi } from 'vitest';

import { albumRecordOf, colorsOfLayer, readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumPicture } from '../../../src/games/coloring/logic/album';
import type { TrashFeedback } from '../../../src/games/coloring/logic/pictureChoice';
import {
  PICTURE_RECORD_LIMIT,
  encodePicture,
  openColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { DeviceStorage } from '../../shared/profileFixtures';
import { memoryDevice } from '../../shared/profileRecordsFixtures';
import { COLORING_GAME_ID, fillAlbum, openWithAlbum, paintLeft } from './albumHelpers';
import type { RemoveFailure } from './albumHelpers';
import {
  EMA,
  HOUSE,
  P_COLOR,
  SwapDevice,
  albumAfter,
  albumPixels,
  choiceOn,
  enterChoice,
  openBigPicture,
  outcomeOf,
  pageOf,
  prepareSwap,
  reloadAndOpen,
  sameAlbum,
  sameImage,
  showPainting,
  swapPictures,
  tapContinue,
  timesIn,
} from './continuePaintingHelpers';
import type { AddFailure, PreparedSwap } from './continuePaintingHelpers';
import { PICTURE_KEY } from './manyColorsHelpers';
import { drawing } from './outlineFixtures';
import { seededRandom } from './recentColorsHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #131 AC3 (kdy se nic nevymění) a AC4 (selhání uložení P do alba
 * za běhu). Označení podle issue: P je rozmalovaná stránka omalovánky před
 * ťuknutím, A obrázek z alba. Zařízení a jeho selhání popisuje
 * `continuePaintingHelpers.ts`.
 *
 * „Štětec se jen zhoupne s tónem domečku“ je zhoupnutí hned
 * (`{ kind: 'wobble' }`), nebo výměna, která skončí `{ kind: 'failed' }`;
 * testy přijmou obojí, protože některé selhání se pozná až po odpovědi
 * úložiště (`outcomeOf`). Dítě pak zůstane na velkém obrázku.
 *
 * Podle doporučení story-reviewer k AC4: po vrácení je A v albu jako
 * nejnovější, ostatní obrázky a jejich pořadí beze změny.
 */

afterEach(() => {
  vi.useRealTimers();
});

const REMOVE_FAILURES: readonly RemoveFailure[] = ['full', 'unavailable', 'rejected'];
const ADD_FAILURES: readonly AddFailure[] = ['full', 'unavailable'];
const FAILURE_NAMES: Readonly<Record<RemoveFailure, string>> = {
  full: 'plné úložiště',
  unavailable: 'nedostupné úložiště',
  rejected: 'chyba úložiště',
};

/** Jak dlouho se drží koš, aby smazal obrázek (#129 AC3). */
const TRASH_HOLD_MS = 1000;

/** Dítě zůstalo na velkém obrázku A, stránka je P a album jako před ťuknutím. */
async function expectNothingSwapped(prepared: PreparedSwap, what: string): Promise<void> {
  const screen = prepared.page.choice.screen();
  expect(screen.kind, `${what}: dítě zůstane na velkém obrázku`).toBe('bigPicture');
  expect(
    screen.kind === 'bigPicture' ? pixelsOf(screen.entry.colors, prepared.page.regions) : [],
    `${what}: velký obrázek je dál A`,
  ).toEqual(prepared.a);
  expect(pageOf(prepared.device), `${what}: stránka je dál P`).toEqual(prepared.p);
  expect(
    sameAlbum(await albumPixels(prepared.device), prepared.albumBefore),
    `${what}: album jako před ťuknutím`,
  ).toBe(true);
}

describe('#131 AC3: když album nejde přečíst ani z něj mazat, nic se nevymění', () => {
  it('nedostupné album: štětec se jen zhoupne s tónem domečku a P i A zůstanou, kde byly', async () => {
    const prepared = await prepareSwap();
    prepared.device.recordsUnavailable = true;

    const outcome = await tapContinue(prepared.page);

    expect(outcome).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    prepared.device.repair();
    await expectNothingSwapped(prepared, 'nedostupné album');
  });

  for (const failure of REMOVE_FAILURES) {
    it(`když A z alba nejde smazat (${FAILURE_NAMES[failure]}), štětec se zhoupne a nic se nevymění ani po obnovení`, async () => {
      const prepared = await prepareSwap();
      prepared.device.removeFailure = failure;

      const outcome = await tapContinue(prepared.page);

      expect(outcome, FAILURE_NAMES[failure]).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      prepared.device.repair();
      await expectNothingSwapped(prepared, FAILURE_NAMES[failure]);
      await reloadAndOpen(prepared.device);
      expect(pageOf(prepared.device), 'po obnovení stránka P').toEqual(prepared.p);
      expect(
        sameAlbum(await albumPixels(prepared.device), prepared.albumBefore),
        'po obnovení album beze změny',
      ).toBe(true);
    });
  }
});

describe('#131 AC3: když stránku nejde uložit, nic se nevymění', () => {
  it('plné úložiště zařízení: štětec se zhoupne s tónem domečku a P i A zůstanou, kde byly', async () => {
    const prepared = await prepareSwap();
    prepared.device.fullAfterWrites(0);

    const outcome = await tapContinue(prepared.page);

    expect(outcome).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    prepared.device.repair();
    await expectNothingSwapped(prepared, 'plné úložiště');
  });

  it('úložiště, které se zaplní uprostřed výměny, nic nevymění napůl: po obnovení je celé P i A', async () => {
    for (let writes = 1; writes <= 4; writes += 1) {
      const prepared = await prepareSwap();
      const what = `úložiště plné po ${writes}. zápisu`;
      prepared.device.fullAfterWrites(writes);

      const outcome = await tapContinue(prepared.page);

      expect(outcome.kind, `${what}: štětec se zhoupne, nebo otevře malování`).not.toBe('ignored');
      if (outcome.kind === 'wobble') {
        expect(outcome.tones, `${what}: tón domečku`).toEqual(HOME_WOBBLE_TONES);
        expect(prepared.page.choice.screen().kind, `${what}: na velkém obrázku`).toBe('bigPicture');
      }
      prepared.device.repair();
      await reloadAndOpen(prepared.device);
      const page = pageOf(prepared.device);
      const album = await albumPixels(prepared.device);
      const before = sameImage(page, prepared.p) && sameAlbum(album, prepared.albumBefore);
      const after = sameImage(page, prepared.a) && sameAlbum(album, albumAfter(prepared, true));
      expect(before || after, `${what}: po obnovení celý stav před, nebo po výměně`).toBe(true);
    }
  });

  it('plné úložiště zařízení pod profilem: výměna se nepočítá s uložením jen v paměti a po obnovení nic nechybí', async () => {
    vi.useRealTimers();
    const storage = new DeviceStorage();
    const recordsDevice = memoryDevice();
    const regions = twoHalves();
    const first = openProfiles(storage, recordsDevice.open());
    const ema = first.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    first.selectProfile(ema.id);
    await fillAlbum(first.gameRecords(COLORING_GAME_ID), 3, HOUSE);
    const house = await openWithAlbum({
      storage: first.gameStorage(COLORING_GAME_ID),
      records: first.gameRecords(COLORING_GAME_ID),
      regions,
    });
    paintLeft(house, P_COLOR);
    house.suspend();
    const p = pixelsOf(house, regions);
    vi.useFakeTimers();

    const visit = openProfiles(storage, recordsDevice.open());
    visit.selectProfile(ema.id);
    const pictures = swapPictures();
    const page = enterChoice(
      visit.gameStorage(COLORING_GAME_ID),
      visit.gameRecords(COLORING_GAME_ID),
      pictures,
    );
    const entry = await openBigPicture(page, 1);
    const a = pixelsOf(entry.colors, regions);
    storage.failWrite = () => true;

    const outcome = await outcomeOf(page.choice.tapContinue());

    expect(outcome, 'štětec se zhoupne, výměna se nepočítá s uložením jen v paměti').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    storage.failWrite = () => false;
    const reloaded = openProfiles(storage, recordsDevice.open());
    reloaded.selectProfile(ema.id);
    const reopened = openColoring({
      regions,
      picture: HOUSE,
      storage: reloaded.gameStorage(COLORING_GAME_ID),
    });
    const shown = await readAlbum(reloaded.gameRecords(COLORING_GAME_ID), pictures);
    const album =
      shown.status === 'read' ? shown.entries.map((each) => pixelsOf(each.colors, regions)) : [];
    expect(pixelsOf(reopened, regions), 'po obnovení stránka P').toEqual(p);
    expect(timesIn(album, a), 'A je dál v albu').toBe(1);
  });
});

describe('#131 AC3: obrázek, který se na stránku nevejde, se nevymění', () => {
  /** Velká omalovánka bez obrysu, aby šel obrázek alba udělat větší než limit stránky. */
  const BIG: PictureIdentity = { id: 'big', version: 1 };

  /**
   * Obrázek s pevnou náhodnou řadou dvou barev (seed), každý pixel jednou
   * z nich napůl. Je větší, než pojme stránka (50 000 znaků, asi 53 000),
   * ale vejde se do alba (asi 100 000 B z 131 072 B).
   */
  function bigLayer(width: number, height: number): Uint8Array {
    const random = seededRandom(131);
    const layer = new Uint8Array(width * height);
    for (let index = 0; index < layer.length; index += 1) {
      layer[index] = random() < 0.5 ? 0 : 1;
    }
    return layer;
  }

  it('obrázek z alba větší než limit stránky: štětec se zhoupne s tónem domečku a obrázek zůstane v albu', async () => {
    vi.useRealTimers();
    const regions = drawing(1024, 768).regions();
    const layer = bigLayer(regions.width, regions.height);
    const pageRecord = encodePicture({
      picture: BIG,
      regions,
      colors: colorsOfLayer(regions, layer),
      selectedColor: 0,
    });
    expect(pageRecord.length, 'na stránku se obrázek nevejde').toBeGreaterThan(
      PICTURE_RECORD_LIMIT,
    );
    const albumRecord = albumRecordOf(BIG, regions, layer);
    expect(albumRecord, 'do alba se obrázek vejde').not.toBeNull();
    const device = new SwapDevice();
    if (albumRecord !== null) {
      expect((await device.records().add(albumRecord)).status).toBe('saved');
    }
    vi.useFakeTimers();
    device.nextLoad();
    const pictures: AlbumPicture[] = [{ identity: BIG, regions }, ...swapPictures()];
    const page = choiceOn(device, { pictures });
    await openBigPicture(page, 0);
    const before = device.snapshot();

    const outcome = await tapContinue(page);

    expect(outcome).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(page.choice.screen().kind, 'dítě zůstane na velkém obrázku').toBe('bigPicture');
    const reloaded = await reloadAndOpen(device, { pictures });
    expect(reloaded.page.choice.screen().kind).toBe('picker');
    expect(device.snapshot().records, 'obrázek je dál v albu').toEqual(before.records);
    const bigPage = openColoring({ regions, picture: BIG, storage: device.reader() });
    expect(bigPage.colorAt(10, 10), 'stránka velké omalovánky zůstala čistá').toBeNull();
  });
});

describe('#131 AC3: nečitelná stránka P se nevymění, nesmaže ani nepřepíše', () => {
  const DAMAGES: ReadonlyArray<readonly [string, (record: string) => string]> = [
    ['zkrácený záznam', (record) => record.slice(0, Math.floor(record.length / 2))],
    ['přepsaný kontrolní součet', (record) => `${record.slice(0, -8)}00000000`],
    ['cizí text', () => 'nesmysl'],
  ];

  for (const [name, damage] of DAMAGES) {
    it(`poškozená stránka P (${name}): štětec se zhoupne s tónem domečku a záznam zůstane, jak byl`, async () => {
      const prepared = await prepareSwap();
      const key = `${EMA}/${PICTURE_KEY}`;
      const stored = prepared.device.kv.get(key);
      expect(stored, 'stránka P je uložená').toBeDefined();
      const damaged = damage(stored ?? '');
      prepared.device.kv.set(key, damaged);

      const outcome = await tapContinue(prepared.page);

      expect(outcome, name).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      expect(prepared.device.kv.get(key), `${name}: záznam se nesmazal ani nepřepsal`).toBe(
        damaged,
      );
      expect(
        sameAlbum(await albumPixels(prepared.device), prepared.albumBefore),
        `${name}: album beze změny`,
      ).toBe(true);
      expect(prepared.page.choice.screen().kind, `${name}: na velkém obrázku`).toBe('bigPicture');
      await reloadAndOpen(prepared.device);
      expect(prepared.device.kv.get(key), `${name}: ani po obnovení`).toBe(damaged);
    });
  }
});

describe('#131 AC4: uložení P do alba selže a A se vrátí', () => {
  for (const failure of ADD_FAILURES) {
    it(`když P nejde uložit (${FAILURE_NAMES[failure]}) a A se vrátí, je A v albu jako nejnovější a stránka P`, async () => {
      const prepared = await prepareSwap({ albumCount: 4, aIndex: 2 });
      prepared.device.nextAddFailures.push(failure);

      const outcome = await tapContinue(prepared.page);

      expect(outcome).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      const others = prepared.albumBefore.filter((pixels) => !sameImage(pixels, prepared.a));
      expect(
        sameAlbum(await albumPixels(prepared.device), [prepared.a, ...others]),
        'A je v albu jako nejnovější, ostatní v původním pořadí',
      ).toBe(true);
      expect(pageOf(prepared.device), 'stránka je P').toEqual(prepared.p);
      const screen = prepared.page.choice.screen();
      expect(screen.kind, 'dítě zůstane na velkém obrázku').toBe('bigPicture');
      expect(
        screen.kind === 'bigPicture' ? pixelsOf(screen.entry.colors, prepared.page.regions) : [],
      ).toEqual(prepared.a);

      await reloadAndOpen(prepared.device);
      expect(pageOf(prepared.device), 'po obnovení stránka P').toEqual(prepared.p);
      expect(
        timesIn(await albumPixels(prepared.device), prepared.a),
        'po obnovení A v albu jednou',
      ).toBe(1);
    });
  }

  it('vrácený obrázek A jde z velkého obrázku dál smazat košem', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    prepared.device.nextAddFailures.push('full');
    expect((await tapContinue(prepared.page)).kind).toBe('wobble');
    const from = prepared.page.trashFeedback.length;

    prepared.page.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS);
    prepared.page.choice.trashButton.release(1);
    const deleting = prepared.page.trashFeedback
      .slice(from)
      .filter(
        (event): event is Extract<TrashFeedback, { kind: 'deleting' }> => event.kind === 'deleting',
      );
    expect(deleting.length, 'podržení koše začne mazat').toBe(1);
    const result = await deleting[0]?.done;

    expect(result?.kind).toBe('deleted');
    expect(timesIn(await albumPixels(prepared.device), prepared.a), 'A je z alba pryč').toBe(0);
  });
});

describe('#131 AC4: když nejde vrátit ani A, maluje dítě A a P počká odložená', () => {
  for (const failure of ADD_FAILURES) {
    it(`když P ani A nejde uložit (${FAILURE_NAMES[failure]}), dítě maluje A a P se doplní při dalším otevření`, async () => {
      const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
      prepared.device.addFailure = failure;

      const outcome = await tapContinue(prepared.page);

      expect(outcome, 'dítě je v malování s A').toEqual({ kind: 'opened', picture: HOUSE });
      const game = await showPainting(prepared.page);
      expect(pixelsOf(game, prepared.page.regions), 'malování ukazuje A').toEqual(prepared.a);
      expect(pageOf(prepared.device), 'stránka je A').toEqual(prepared.a);
      const meanwhile = await albumPixels(prepared.device);
      expect(timesIn(meanwhile, prepared.a), 'A není v albu').toBe(0);
      expect(timesIn(meanwhile, prepared.p), 'P zatím není v albu').toBe(0);

      prepared.device.repair();
      await reloadAndOpen(prepared.device);

      const album = await albumPixels(prepared.device);
      expect(album[0], 'P se doplnila do alba jako nejnovější').toEqual(prepared.p);
      expect(sameAlbum(album, albumAfter(prepared, true)), 'album jako po výměně').toBe(true);
      expect(pageOf(prepared.device), 'stránka je dál A').toEqual(prepared.a);
    });
  }

  it('dokud úložiště nejde použít, P zůstane odložená a nic se neztratí ani nebude dvakrát', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 0 });
    prepared.device.addFailure = 'unavailable';
    expect((await tapContinue(prepared.page)).kind).toBe('opened');

    for (let visit = 1; visit <= 2; visit += 1) {
      await reloadAndOpen(prepared.device);
      const album = await albumPixels(prepared.device);
      const what = `${visit}. otevření s nedostupným ukládáním`;
      expect(timesIn(album, prepared.p), `${what}: P v albu ještě není`).toBe(0);
      expect(timesIn(album, prepared.a), `${what}: A v albu není`).toBe(0);
      expect(pageOf(prepared.device), `${what}: stránka je A`).toEqual(prepared.a);
    }

    prepared.device.repair();
    await reloadAndOpen(prepared.device);
    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.p), 'P je v albu právě jednou').toBe(1);
    expect(timesIn(album, prepared.a), 'A v albu není').toBe(0);
    await reloadAndOpen(prepared.device);
    expect(
      timesIn(await albumPixels(prepared.device), prepared.p),
      'ani další otevření P neuloží podruhé',
    ).toBe(1);
  });

  it('malování A mezitím nic nepokazí: tahy na A zůstanou a P se doplní do alba jednou', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    prepared.device.addFailure = 'full';
    expect((await tapContinue(prepared.page)).kind).toBe('opened');
    const game = await showPainting(prepared.page);
    game.tapColor(P_COLOR + 5);
    for (const y of [40, 80, 120]) {
      game.pointerDown({ id: 1, x: 200, y, kind: 'touch' });
      game.pointerMove({ id: 1, x: 260, y, kind: 'touch' });
      game.pointerUp(1);
    }
    const painted = pixelsOf(game, prepared.page.regions);
    expect(sameImage(painted, prepared.a), 'dítě na A něco namalovalo').toBe(false);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    expect(prepared.page.choice.holdHome()).toBe('toPicker');
    game.suspend();

    const again = prepared.page.choice.tapPreview(0);
    expect(again.kind, 'náhled domku jde otevřít a malovat dál').toBe('open');

    prepared.device.repair();
    await reloadAndOpen(prepared.device);
    expect(pageOf(prepared.device), 'tahy na A zůstaly').toEqual(painted);
    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.p), 'P je v albu jednou').toBe(1);
    expect(timesIn(album, prepared.a), 'A v albu není').toBe(0);
    expect(album.length, 'v albu je stejně obrázků jako před ťuknutím').toBe(
      prepared.albumBefore.length,
    );
  });
});
