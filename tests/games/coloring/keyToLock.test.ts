import { describe, expect, it } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import { KEY_FLIGHT_MS, KEY_WAIT_MS } from '../../../src/games/coloring/logic/pictureChoice';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import {
  FREE_IDS,
  LOCKED_IDS,
  advanceLockClock,
  choiceWith,
  choiceWithAlbum,
  completeMaps,
  enterColoring,
  loadPage,
  lockDevice,
  lockedIdsOf,
  paintAndReturn,
  photograph,
  pictureOf,
  previewIndexOf,
  sendKeyTo,
  setPictures,
  snapshotOf,
  tapPicture,
  tapTwice,
} from './pictureLocksHelpers';

/**
 * Testy k #159: ukazatel klíčů s obrysem celého klíče (AC1, logika počtu
 * a půlky) a odemknutí zamčené omalovánky až druhým ťuknutím (AC2–AC5).
 * AC2 a AC3 nahrazují spotřebu klíče jedním ťuknutím z #140 AC5 (testy
 * #140 v `pictureLockTaps.test.ts` jsou přepsané na dvě ťuknutí).
 * Rozložení (AC6) testuje `keyInLockLayoutRules.test.ts`, let klíče
 * v 60 fps a vzhled obrysu (AC1, AC7) jsou ruční kontrola.
 *
 * Dítě ťuká na náhledy výběru (`PictureChoice.tapPreview`, přes
 * `tapPicture`), výběr dostane zámky volbou `locks` jako v #140.
 *
 * Navržené rozšíření `pictureChoice.ts`:
 * - `KEY_FLIGHT_MS = 500` let klíče z ukazatele do zámku (AC2),
 * - `KEY_WAIT_MS = 5000` jak dlouho klíč čeká v zámku na druhé ťuknutí
 *   (AC4); testy počítají s 5 s od ťuknutí, které klíč poslalo, nebo od
 *   doletu (obojí projde),
 * - `PreviewTap` navíc `{ kind: 'keyToLock'; index; from: number | null;
 *   tones }`: zamčená omalovánka s celým klíčem, klíč letí do jejího
 *   zámku z ukazatele (`from: null`), nebo ze zámku náhledu `from` na
 *   stejné stránce; nic se nespotřebuje a výběr zůstane (AC2, AC4),
 * - `PictureChoice.keyLanded(): void` scéna hlásí, že klíč doletěl do
 *   zámku (jako `paintingShown`); do té doby druhé ťuknutí nic nespotřebuje,
 * - `PictureChoice.keyInLock(): { picture; index; landed } | null` kde je
 *   klíč; `null`, když je klíč v ukazateli (po 5 s bez ťuknutí, po ťuknutí
 *   jinam, nový výběr po obnovení stránky). Scéna podle něj klíč vrátí.
 * Druhé ťuknutí na stejnou omalovánku po doletu vrátí `unlocked` jako
 * dřív v #140 AC5; když klíč mezitím utratil jiný panel, `locked` (#140 AC4)
 * a klíč se vrátí.
 */

describe('#159 AC1: ukazatel ukazuje celé klíče a půlku', () => {
  it('ukazatel ukazuje počet celých klíčů a půlku podle dokončených map', async () => {
    for (let maps = 0; maps <= 7; maps += 1) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, maps);
      const locks = await enterColoring(page);

      expect(locks.keyIndicator(), `${maps} map`).toEqual({
        wholeKeys: Math.floor(maps / 2),
        hasHalf: maps % 2 === 1,
      });
    }
  });

  it('nula klíčů bez půlky ukazatel ukáže s nulou jako v #140', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    expect(locks.keyIndicator()).toEqual({ wholeKeys: 0, hasHalf: false });
  });

  it('když není zamčená žádná omalovánka, ukazatel zmizí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2 * LOCKED_IDS.length + 1);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);

    for (const id of LOCKED_IDS) {
      expect(locks.keyIndicator(), `před odemčením ${id}`).not.toBeNull();
      sendKeyTo(choice, id);
      expect(tapPicture(choice, id).kind, id).toBe('unlocked');
      paintAndReturn(choice);
    }

    expect(locks.keyIndicator()).toBeNull();
  });
});

describe('#159 AC2: první ťuknutí pošle klíč do zámku a nic nespotřebuje', () => {
  it('klíč letí do zámku půl sekundy', () => {
    expect(KEY_FLIGHT_MS).toBe(500);
  });

  it('první ťuknutí na zamčenou omalovánku s celým klíčem pošle klíč z ukazatele do jejího zámku', async () => {
    for (const id of LOCKED_IDS) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, 2);
      const choice = choiceWith(await enterColoring(page));

      expect(tapPicture(choice, id), id).toMatchObject({
        kind: 'keyToLock',
        index: previewIndexOf(id),
        from: null,
      });
      expect(choice.keyInLock(), `${id}: klíč letí`).toMatchObject({
        picture: pictureOf(id),
        index: previewIndexOf(id),
        landed: false,
      });
      choice.keyLanded();
      expect(choice.keyInLock(), `${id}: klíč je v zámku`).toMatchObject({
        picture: pictureOf(id),
        landed: true,
      });
    }
  });

  it('po prvním ťuknutí zůstane výběr, omalovánka zamčená a počet klíčů stejný', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 3);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    const before = snapshotOf(device);

    sendKeyTo(choice, 'car');

    expect(choice.screen(), 'zůstane výběr').toEqual({ kind: 'picker' });
    expect(locks.isLocked(pictureOf('car')), 'auto je zamčené').toBe(true);
    expect(locks.keyIndicator(), 'počet klíčů se nezmění').toEqual({
      wholeKeys: 1,
      hasHalf: true,
    });
    expect(page.keys.spentItems(), 'nic se neutratilo').toEqual([]);
    expect(snapshotOf(device), 'nic se nezapsalo').toEqual(before);
  });
});

describe('#159 AC3: druhé ťuknutí po doletu klíče omalovánku odemkne', () => {
  it('druhé ťuknutí na stejnou omalovánku po doletu ji odemkne, ubude jeden klíč a omalovánka se otevře', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 4);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(tapPicture(choice, 'car')).toMatchObject({
      kind: 'unlocked',
      index: previewIndexOf('car'),
      picture: pictureOf('car'),
    });

    expect(choice.screen()).toEqual({ kind: 'opening', picture: pictureOf('car') });
    expect(locks.isLocked(pictureOf('car'))).toBe(false);
    expect(locks.keyIndicator(), 'ubyl jeden klíč').toEqual({ wholeKeys: 1, hasHalf: false });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: pictureOf('car') });
  });

  it('ťuknutí dřív, než klíč doletí, nic nespotřebuje', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');

    for (let tap = 1; tap <= 3; tap += 1) {
      expect(tapPicture(choice, 'car').kind, `${tap}. ťuknutí za letu`).not.toBe('unlocked');
    }

    expect(locks.isLocked(pictureOf('car'))).toBe(true);
    expect(page.keys.balance().wholeKeys, 'klíč zůstal').toBe(1);
    expect(page.keys.spentItems()).toEqual([]);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('klíč v zámku počká na druhé ťuknutí aspoň 4 s', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const choice = choiceWith(await enterColoring(page));
    sendKeyTo(choice, 'car');

    advanceLockClock(4000);

    expect(tapPicture(choice, 'car').kind).toBe('unlocked');
  });
});

describe('#159 AC4: ťuknutí jinam vrátí klíč a nic nespotřebuje', () => {
  it('ťuknutí na jinou zamčenou omalovánku pošle klíč k ní', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(tapPicture(choice, 'butterfly')).toMatchObject({
      kind: 'keyToLock',
      index: previewIndexOf('butterfly'),
      from: previewIndexOf('car'),
    });
    expect(choice.keyInLock()).toMatchObject({ picture: pictureOf('butterfly') });
    expect(page.keys.balance().wholeKeys, 'nic se nespotřebovalo').toBe(1);

    expect(tapPicture(choice, 'car').kind, 'auto už klíč v zámku nemá').toBe('keyToLock');
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('ťuknutí na odemčenou omalovánku ji otevře a klíč se vrátí', async () => {
    for (const id of FREE_IDS) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, 2);
      const locks = await enterColoring(page);
      const choice = choiceWith(locks);
      sendKeyTo(choice, 'car');

      expect(tapPicture(choice, id), id).toMatchObject({ kind: 'open', picture: pictureOf(id) });
      expect(choice.keyInLock(), `${id}: klíč je zpátky`).toBeNull();
      expect(page.keys.balance().wholeKeys, `${id}: nic se nespotřebovalo`).toBe(1);

      paintAndReturn(choice);
      expect(tapPicture(choice, 'car').kind, `${id}: po návratu znovu první ťuknutí`).toBe(
        'keyToLock',
      );
      expect(lockedIdsOf(locks), id).toEqual(LOCKED_IDS);
    }
  });

  it('ťuknutí na prázdné místo vrátí klíč a nic nespotřebuje', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const choice = choiceWith(await enterColoring(page));
    sendKeyTo(choice, 'car');

    choice.pickerPointerDown(1, { x: 500, y: 400 }, null);
    expect(choice.pickerPointerUp(1, { x: 502, y: 401 }).kind).toBe('ignored');

    expect(choice.keyInLock()).toBeNull();
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(tapPicture(choice, 'car').kind, 'znovu první ťuknutí').toBe('keyToLock');
    expect(page.keys.balance().wholeKeys).toBe(1);
  });

  it('ťuknutí na knihu otevře album jako dřív a klíč se vrátí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    await photograph(page, 'house');
    const choice = choiceWithAlbum(page, locks);
    sendKeyTo(choice, 'car');

    const album = await readAlbum(page.records, setPictures());
    expect(choice.tapBook(album).kind, 'kniha otevře album').toBe('open');
    expect(choice.keyInLock()).toBeNull();

    expect(choice.holdHome(), 'domeček z alba na výběr').toBe('toPicker');
    expect(tapPicture(choice, 'car').kind, 'znovu první ťuknutí').toBe('keyToLock');
    expect(page.keys.balance().wholeKeys).toBe(1);
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('ťuknutí na knihu s prázdným albem knihu zhoupne jako dřív a klíč se vrátí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const choice = choiceWith(await enterColoring(page));
    sendKeyTo(choice, 'car');

    expect(choice.tapBook(null)).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });

    expect(choice.keyInLock()).toBeNull();
    expect(tapPicture(choice, 'car').kind, 'znovu první ťuknutí').toBe('keyToLock');
  });

  it('domeček vede do menu jako dřív a klíč se vrátí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(choice.holdHome()).toBe('toMenu');

    expect(choice.keyInLock()).toBeNull();
    expect(page.keys.balance().wholeKeys).toBe(1);
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('po 5 s bez ťuknutí se klíč vrátí a další ťuknutí ho zase jen pošle do zámku', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(KEY_WAIT_MS, 'klíč čeká 5 s').toBe(5000);
    advanceLockClock(KEY_FLIGHT_MS + KEY_WAIT_MS);

    expect(choice.keyInLock(), 'klíč je zpátky v ukazateli').toBeNull();
    expect(tapPicture(choice, 'car').kind, 'ťuknutí po 5 s neodemkne').toBe('keyToLock');
    expect(page.keys.balance().wholeKeys).toBe(1);
    expect(locks.isLocked(pictureOf('car'))).toBe(true);
  });

  it('po obnovení stránky je klíč zpátky v ukazateli a nic se nespotřebovalo', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 2);
    sendKeyTo(choiceWith(await enterColoring(loadPage(device))), 'car');

    const reloadedPage = loadPage(device);
    const reloaded = await enterColoring(reloadedPage);
    const choice = choiceWith(reloaded);

    expect(choice.keyInLock(), 'klíč není v zámku').toBeNull();
    expect(reloaded.keyIndicator()).toEqual({ wholeKeys: 1, hasHalf: false });
    expect(tapPicture(choice, 'car').kind, 'první ťuknutí po obnovení').toBe('keyToLock');
    expect(reloadedPage.keys.spentItems()).toEqual([]);
    expect(lockedIdsOf(reloaded)).toEqual(LOCKED_IDS);
  });
});

describe('#159 AC5: okrajové případy', () => {
  it('bez celého klíče se zámek jen zhoupne jako v #140 a půlka nikam neletí', async () => {
    for (const maps of [0, 1]) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, maps);
      const locks = await enterColoring(page);
      const choice = choiceWith(locks);

      for (const id of LOCKED_IDS) {
        expect(tapPicture(choice, id), `${maps} map, ${id}`).toEqual({
          kind: 'locked',
          index: previewIndexOf(id),
          tones: HOME_WOBBLE_TONES,
        });
        expect(choice.keyInLock(), `${maps} map, ${id}: nic neletí`).toBeNull();
      }
      expect(locks.keyIndicator(), `${maps} map`).toEqual({
        wholeKeys: 0,
        hasHalf: maps === 1,
      });
    }
  });

  it('dvojí ťuknutí a druhý prst po doletu klíče spotřebují jen jeden klíč', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 4);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(tapPicture(choice, 'car').kind).toBe('unlocked');
    expect(tapPicture(choice, 'car'), 'dvojí ťuknutí').toEqual({ kind: 'ignored' });
    expect(tapPicture(choice, 'butterfly'), 'druhý prst na jiné zamčené').toEqual({
      kind: 'ignored',
    });

    expect(page.keys.balance().wholeKeys, 'utratil se jeden klíč').toBe(1);
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
  });

  it('dva panely s jedním klíčem v zámku dvou omalovánek odemknou jen jednu', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 2);
    const firstLocks = await enterColoring(loadPage(device));
    const secondLocks = await enterColoring(loadPage(device));
    const first = choiceWith(firstLocks);
    const second = choiceWith(secondLocks);
    sendKeyTo(first, 'car');
    sendKeyTo(second, 'butterfly');

    expect(tapPicture(first, 'car').kind, '1. panel').toBe('unlocked');
    expect(tapPicture(second, 'butterfly'), '2. panel se chová jako bez klíče').toEqual({
      kind: 'locked',
      index: previewIndexOf('butterfly'),
      tones: HOME_WOBBLE_TONES,
    });

    expect(second.keyInLock(), '2. panel: klíč se vrátil').toBeNull();
    expect(secondLocks.keyIndicator(), '2. panel: 0 klíčů').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded), 'po obnovení').toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
  });

  it('ve dvou panelech ukazatel nikdy neukáže záporné číslo a odemkne se nejvýš tolik, kolik bylo celých klíčů', async () => {
    for (let keys = 0; keys <= 3; keys += 1) {
      const device = lockDevice();
      completeMaps(loadPage(device).keys, 2 * keys);
      const panels = [await enterColoring(loadPage(device)), await enterColoring(loadPage(device))];
      const choices = panels.map((locks) => choiceWith(locks));

      // Oba panely pošlou klíč do zámku, než kterýkoli z nich odemkne.
      LOCKED_IDS.forEach((id, index) => {
        const choice = choices[index % 2];
        const other = choices[(index + 1) % 2];
        if (choice === undefined || other === undefined) {
          return;
        }
        const firstTap = tapPicture(choice, id);
        if (firstTap.kind === 'keyToLock') {
          choice.keyLanded();
        }
        const otherTap = tapTwice(other, id);
        const tap = tapPicture(choice, id);
        for (const [panel, result] of [
          [other, otherTap],
          [choice, tap],
        ] as const) {
          // Omalovánku odemčenou druhým panelem první panel rovnou otevře.
          if (result.kind === 'unlocked' || result.kind === 'open') {
            paintAndReturn(panel);
          }
        }
        for (const locks of panels) {
          const wholeKeys = locks.keyIndicator()?.wholeKeys ?? 0;
          expect(wholeKeys, `${keys} klíčů, po ${id}`).toBeGreaterThanOrEqual(0);
        }
      });

      const reloaded = await enterColoring(loadPage(device));
      expect(LOCKED_IDS.length - lockedIdsOf(reloaded).length, `${keys} klíčů`).toBe(keys);
      expect(loadPage(device).keys.balance().wholeKeys, `${keys} klíčů: zbylo`).toBe(0);
    }
  });
});

describe('#159 upřesnění 1: klíč čeká v zámku 5 s od doletu', () => {
  it('klíč, který doletěl později, počká celých 5 s od doletu a pak se vrátí do ukazatele', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');

    // Let se na pomalém tabletu protáhl na 2 s, klíč doletěl až potom.
    advanceLockClock(2000);
    expect(choice.keyInLock(), 'klíč ještě letí').toMatchObject({ landed: false });
    choice.keyLanded();
    advanceLockClock(KEY_WAIT_MS - 1);
    expect(choice.keyInLock(), 'těsně před 5 s od doletu je klíč v zámku').toMatchObject({
      picture: pictureOf('car'),
      landed: true,
    });

    advanceLockClock(1);
    expect(choice.keyInLock(), '5 s od doletu je klíč zpátky v ukazateli').toBeNull();
    expect(tapPicture(choice, 'car').kind, 'další ťuknutí klíč zase jen pošle').toBe('keyToLock');
    expect(page.keys.balance().wholeKeys).toBe(1);
    expect(locks.isLocked(pictureOf('car'))).toBe(true);
  });

  it('druhé ťuknutí 4,9 s po pozdním doletu omalovánku odemkne', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    expect(tapPicture(choice, 'car').kind).toBe('keyToLock');
    advanceLockClock(2000);
    choice.keyLanded();

    advanceLockClock(4900);

    expect(tapPicture(choice, 'car').kind, 'přes 6 s od prvního ťuknutí').toBe('unlocked');
    expect(locks.isLocked(pictureOf('car'))).toBe(false);
  });
});

describe('#159 upřesnění 3: listování výběru vrátí klíč do ukazatele', () => {
  it('šipka na další stránku vrátí klíč a zamčená omalovánka na ní dostane klíč z ukazatele', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    expect(choice.tapPickerArrow('next').kind).toBe('turned');
    expect(choice.keyInLock(), 'klíč se při listování vrátil').toBeNull();
    choice.pickerPageShown();
    expect(
      choice.pagePreviews().map((picture) => picture.id),
      'sova je na 2. stránce',
    ).toContain('owl');

    expect(tapPicture(choice, 'owl'), 'klíč letí z ukazatele').toMatchObject({
      kind: 'keyToLock',
      index: previewIndexOf('owl'),
      from: null,
    });
    expect(page.keys.balance().wholeKeys, 'nic se nespotřebovalo').toBe(1);
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('tah prstem vrátí klíč a po návratu na stránku první ťuknutí klíč zase jen pošle', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    sendKeyTo(choice, 'car');

    choice.pickerPointerDown(1, { x: 600, y: 400 }, previewIndexOf('fish'));
    expect(choice.pickerPointerUp(1, { x: 400, y: 405 }).kind, 'tah doleva').toBe('turned');
    expect(choice.keyInLock(), 'klíč se při listování vrátil').toBeNull();
    choice.pickerPageShown();
    expect(choice.tapPickerArrow('previous').kind).toBe('turned');
    choice.pickerPageShown();

    expect(tapPicture(choice, 'car'), 'auto neodemkne, klíč letí z ukazatele').toMatchObject({
      kind: 'keyToLock',
      from: null,
    });
    expect(page.keys.balance().wholeKeys).toBe(1);
    expect(locks.isLocked(pictureOf('car'))).toBe(true);
  });
});
