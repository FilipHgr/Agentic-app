import { describe, expect, it } from 'vitest';

import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { at } from './strokeHelpers';
import {
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
 * Testy k #92 AC1 (uložení obrázku) a AC3 (odchod uprostřed tahu).
 * Odchod domečkem, schování stránky (přepnutí aplikace, zamčení iPadu)
 * i zavření panelu hlásí scéna logice jako `suspend()`. Zavření panelu
 * a obnovení stránky je v testu nové `openProfiles(storage)` bez dalšího
 * volání; uložení musí být hotové synchronně (poznámky pro vývojáře).
 */

const ORANGE = 1;
const BLUE = 4;

describe('#92 AC1: obrázek se uloží po každém dokončeném tahu', () => {
  it('hned po zvednutí prstu je obrázek uložený, bez čekání na cokoli dalšího', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    expect(storage.keys(), 'před prvním tahem').toEqual([]);

    paint(game, [at(40, 50), at(120, 50)]);

    expect(storage.keys().length, 'po zvednutí prstu je záznam v úložišti').toBeGreaterThan(0);
    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(pixelsOf(game, regions));
  });

  it('každý další dokončený tah se uloží také', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);

    paint(game, [at(40, 50), at(120, 50)]);
    game.tapColor(BLUE);
    paint(game, [at(200, 150), at(280, 150)]);

    const reopened = openOn(storage, regions);
    expect(reopened.colorAt(200, 150), 'druhý tah').toBe(BLUE);
    expect(pixelsOf(reopened, regions)).toEqual(pixelsOf(game, regions));
  });

  it('po návratu domečkem do menu je obrázek stejný pixel po pixelu a vybraná naposledy použitá barva', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    game.tapColor(ORANGE);
    paint(game, [at(30, 30), at(130, 170)]);
    game.tapColor(BLUE);
    paint(game, [at(170, 30), at(290, 100), at(170, 170)]);
    const before = pixelsOf(game, regions);
    game.suspend();

    const again = enterColoring(store, regions);
    expect(pixelsOf(again, regions)).toEqual(before);
    expect(again.palette().selected).toBe(BLUE);
  });

  it('po schování stránky (přepnutí aplikace, zamčení iPadu) a obnovení stránky je obrázek stejný', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    const before = pixelsOf(game, regions);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reloaded, regions)).toEqual(before);
    expect(reloaded.palette().selected).toBe(BLUE);
  });

  it('po schování stránky jde malovat dál a další tah se uloží', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();
    game.tapColor(ORANGE);
    paint(game, [at(200, 40), at(260, 40)]);

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reloaded, regions)).toEqual(pixelsOf(game, regions));
    expect(reloaded.colorAt(230, 40)).toBe(ORANGE);
  });

  it('po zavření panelu bez odchodu domečkem a novém otevření je obrázek stejný', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const closed = enterColoring(openProfiles(storage), regions);
    closed.tapColor(ORANGE);
    paint(closed, [at(60, 20), at(60, 180)]);
    // Panel se zavřel: žádné `suspend()`, platí uložení po tahu.

    const reopened = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reopened, regions)).toEqual(pixelsOf(closed, regions));
    expect(reopened.palette().selected).toBe(ORANGE);
  });

  // Rozhodnutí vlastníka: „naposledy použitá barva“ je barva naposledy
  // vybraná v paletě, i když se jí ještě nemalovalo.
  it('po výběru barvy bez tahu a návratu domečkem je vybraná tato barva', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    game.tapColor(ORANGE);
    paint(game, [at(30, 30), at(130, 170)]);
    game.tapColor(BLUE);
    game.suspend();

    const again = enterColoring(store, regions);
    expect(again.palette().selected, 'barva vybraná po posledním tahu').toBe(BLUE);
    expect(again.colorAt(80, 100), 'tah zůstal v barvě, kterou se malovalo').toBe(ORANGE);
  });

  it('po výběru barvy bez tahu, schování a obnovení stránky je vybraná tato barva', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(BLUE);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(reloaded.palette().selected).toBe(BLUE);
    expect(paintedPixels(reloaded, regions), 'nic se nenamalovalo').toBe(0);
  });

  it('ťuknutí na barvu ji uloží hned, bez tahu a bez odchodu ze hry', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    // Žádné `suspend()` ani tah: panel se mohl hned zavřít.

    expect(openOn(storage, regions).palette().selected).toBe(BLUE);
  });

  it('obnovený obrázek jde dál malovat a přebarvit', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    paint(enterColoring(openProfiles(storage), regions), [at(40, 100), at(120, 100)]);

    const reloaded = enterColoring(openProfiles(storage), regions);
    reloaded.tapColor(BLUE);
    paint(reloaded, [at(80, 80), at(80, 120)]);

    expect(reloaded.colorAt(80, 100), 'přebarvené místo').toBe(BLUE);
    expect(reloaded.colorAt(45, 100), 'původní barva mimo nový tah').toBe(0);
  });
});

describe('#92 AC3: odchod uprostřed tahu tah ukončí a uloží až do místa, kam prst došel', () => {
  it('odchod domečkem s prstem na ploše uloží tah až k poslednímu bodu', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const game = enterColoring(store, regions);
    startStroke(game, [at(20, 100), at(80, 100)]);
    const before = pixelsOf(game, regions);
    game.suspend();

    const again = enterColoring(store, regions);
    expect(again.colorAt(78, 100), 'místo, kam prst došel').toBe(0);
    expect(pixelsOf(again, regions)).toEqual(before);
  });

  it('po schování stránky uprostřed tahu se tah uloží i bez zvednutí prstu', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(BLUE);
    startStroke(game, [at(200, 30), at(200, 120)]);
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(reloaded.colorAt(200, 118)).toBe(BLUE);
    expect(reloaded.colorAt(200, 140), 'za místem, kam prst došel').toBeNull();
    expect(pixelsOf(reloaded, regions)).toEqual(pixelsOf(game, regions));
  });

  it('tah skončí: další pohyb téhož prstu po návratu na stránku nic nenamaluje', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    startStroke(game, [at(20, 100), at(60, 100)]);
    game.suspend();
    const painted = paintedPixels(game, regions);

    game.pointerMove({ id: 1, x: 130, y: 100, kind: 'touch' });
    game.pointerUp(1);

    expect(paintedPixels(game, regions), 'nic se nedokreslilo').toBe(painted);
    expect(game.colorAt(120, 100)).toBeNull();
  });

  it('po ukončeném tahu začne nový dotyk malovat znovu', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    startStroke(game, [at(20, 100), at(60, 100)]);
    game.suspend();

    paint(game, [at(200, 50), at(260, 50)], 2);

    expect(game.colorAt(230, 50)).toBe(0);
    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reloaded, regions)).toEqual(pixelsOf(game, regions));
  });

  it('systémové přerušení tahu (hovor, gesto systému) tah také uloží', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    startStroke(game, [at(20, 60), at(100, 60)]);
    game.interrupt();

    const reopened = openOn(storage, regions);
    expect(reopened.colorAt(95, 60)).toBe(0);
    expect(pixelsOf(reopened, regions)).toEqual(pixelsOf(game, regions));
  });

  it('odchod bez rozmalovaného tahu nic nezkazí a obrázek zůstane stejný', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    paint(game, [at(20, 60), at(100, 60)]);
    game.suspend();
    game.suspend();

    const reloaded = enterColoring(openProfiles(storage), regions);
    expect(pixelsOf(reloaded, regions)).toEqual(pixelsOf(game, regions));
  });
});
