import { describe, expect, it } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import { PREVIEW_TAP_TONES } from '../../../src/games/coloring/logic/pictureChoice';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { settle } from './albumHelpers';
import {
  FREE_IDS,
  LOCKED_IDS,
  choiceWith,
  choiceWithAlbum,
  completeMaps,
  enterColoring,
  loadPage,
  lockDevice,
  lockedIdsOf,
  pageOfStore,
  paintAndReturn,
  paintPage,
  photograph,
  pictureOf,
  previewIndexOf,
  setPictures,
  snapshotOf,
  tapPicture,
  unlockByTap,
} from './pictureLocksHelpers';

/**
 * Testy k #140 AC4 (bez klíče), AC5 (odemčení klíčem), AC6 (dvojí ťuknutí,
 * druhý prst, dva panely) a AC7 (odemčení, které se nepodaří uložit). Dítě
 * ťuká na náhledy výběru (`PictureChoice.tapPreview`), výběr dostane zámky
 * volbou `startPictureChoice(pictures, { locks })`.
 *
 * Navržené rozšíření `PreviewTap` v `pictureChoice.ts`:
 * - `{ kind: 'locked'; index; tones }` zamčená omalovánka bez celého
 *   klíče: zámek a ukazatel klíčů se zhoupnou s tónem domečku
 *   (`HOME_WOBBLE_TONES`), výběr zůstane a nic se nezmění (AC4),
 * - `{ kind: 'unlocked'; index; picture; tones }` klíč se utratil, zámek
 *   se otevře a omalovánka se otevírá (obrazovka `opening`, scéna pak
 *   hlásí `paintingShown`) (AC5).
 * Druhý prst a dvojí ťuknutí během otevírání se nepočítají jako dřív
 * (`ignored`, #124 AC5), takže se utratí jen jeden klíč (AC6).
 */

describe('#140 AC4: bez celého klíče se zamčená omalovánka neotevře', () => {
  it('ťuknutí na zamčenou omalovánku bez klíče zhoupne zámek s tónem domečku a nic nezmění', async () => {
    for (const maps of [0, 1]) {
      const device = lockDevice();
      const page = loadPage(device);
      completeMaps(page.keys, maps);
      const locks = await enterColoring(page);
      const choice = choiceWith(locks);
      const indicator = locks.keyIndicator();
      const before = snapshotOf(device);

      for (const id of LOCKED_IDS) {
        const what = `${maps} map, ${id}`;
        expect(tapPicture(choice, id), what).toEqual({
          kind: 'locked',
          index: previewIndexOf(id),
          tones: HOME_WOBBLE_TONES,
        });
        expect(choice.screen(), `${what}: zůstane výběr`).toEqual({ kind: 'picker' });
      }

      expect(lockedIdsOf(locks), `${maps} map`).toEqual(LOCKED_IDS);
      expect(locks.keyIndicator(), `${maps} map: ukazatel stejný`).toEqual(indicator);
      expect(snapshotOf(device), `${maps} map: nic se nezapsalo`).toEqual(before);
    }
  });

  it('opakované ťuknutí bez klíče zámek pokaždé jen zhoupne', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));
    const choice = choiceWith(locks);

    for (let tap = 1; tap <= 3; tap += 1) {
      expect(tapPicture(choice, 'car').kind, `${tap}. ťuknutí`).toBe('locked');
    }
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('odemčené omalovánky se otevřou i bez klíče jako dřív', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    for (const id of FREE_IDS) {
      const choice = choiceWith(locks);
      expect(tapPicture(choice, id), id).toEqual({
        kind: 'open',
        index: previewIndexOf(id),
        picture: pictureOf(id),
        tones: PREVIEW_TAP_TONES,
      });
    }
  });
});

describe('#140 AC5: celý klíč odemkne omalovánku a ta se hned otevře', () => {
  it('s celým klíčem ťuknutí spotřebuje klíč a otevře omalovánku k malování', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);

    const tap = tapPicture(choice, 'car');

    expect(tap).toMatchObject({
      kind: 'unlocked',
      index: previewIndexOf('car'),
      picture: pictureOf('car'),
    });
    expect(choice.screen()).toEqual({ kind: 'opening', picture: pictureOf('car') });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: pictureOf('car') });
    expect(locks.isLocked(pictureOf('car'))).toBe(false);
    expect(page.keys.balance().wholeKeys, 'klíč je spotřebovaný').toBe(0);
  });

  it('klíčem se odemkne jen omalovánka, na kterou dítě ťuklo', async () => {
    for (const id of LOCKED_IDS) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, 2);
      const locks = await enterColoring(page);

      unlockByTap(choiceWith(locks), id);

      expect(lockedIdsOf(locks), id).toEqual(LOCKED_IDS.filter((each) => each !== id));
    }
  });

  it('odemčená omalovánka zůstane odemčená po návratu na výběr a klíč se znovu nebere', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 4);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);
    unlockByTap(choice, 'car');

    expect(tapPicture(choice, 'car').kind, 'po návratu na výběr').toBe('open');
    expect(page.keys.balance().wholeKeys, 'zbyl jeden klíč').toBe(1);
  });

  it('odemčená omalovánka zůstane odemčená při dalším otevření Omalovánek i po obnovení stránky', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 2);
    unlockByTap(choiceWith(await enterColoring(page)), 'car');

    const again = await enterColoring(page);
    expect(lockedIdsOf(again), 'další otevření').not.toContain('car');
    expect(tapPicture(choiceWith(again), 'car').kind, 'další otevření').toBe('open');

    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded), 'po obnovení').toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
    expect(reloaded.keyIndicator(), 'po obnovení klíč zpátky není').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
  });
});

describe('#140 AC6: během odemykání se utratí jen jeden klíč', () => {
  it('dvojí ťuknutí, druhý prst i ťuknutí na jinou zamčenou omalovánku během odemykání nic neudělá', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 6);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);

    expect(tapPicture(choice, 'car').kind).toBe('unlocked');
    expect(tapPicture(choice, 'car'), 'dvojí ťuknutí').toEqual({ kind: 'ignored' });
    expect(tapPicture(choice, 'car'), 'druhý prst').toEqual({ kind: 'ignored' });
    expect(tapPicture(choice, 'butterfly'), 'jiná zamčená').toEqual({ kind: 'ignored' });
    expect(tapPicture(choice, 'house'), 'odemčená').toEqual({ kind: 'ignored' });

    expect(page.keys.balance().wholeKeys, 'utratil se jen jeden klíč').toBe(2);
    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
    expect(choice.screen()).toEqual({ kind: 'opening', picture: pictureOf('car') });
  });

  it('ve dvou panelech s jedním klíčem odemkne omalovánku jen první, druhý se chová jako bez klíče', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 2);
    const firstLocks = await enterColoring(loadPage(device));
    const secondLocks = await enterColoring(loadPage(device));
    const first = choiceWith(firstLocks);
    const second = choiceWith(secondLocks);

    expect(tapPicture(first, 'car').kind, '1. panel').toBe('unlocked');
    expect(tapPicture(second, 'butterfly'), '2. panel').toEqual({
      kind: 'locked',
      index: previewIndexOf('butterfly'),
      tones: HOME_WOBBLE_TONES,
    });

    expect(secondLocks.keyIndicator(), '2. panel: 0 klíčů').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
    expect(secondLocks.isLocked(pictureOf('butterfly'))).toBe(true);
    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded), 'po obnovení').toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
  });

  it('omalovánku odemčenou v jednom panelu druhý panel otevře bez dalšího klíče', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 4);
    const first = choiceWith(await enterColoring(loadPage(device)));
    const secondPage = loadPage(device);
    const second = choiceWith(await enterColoring(secondPage));

    expect(tapPicture(first, 'car').kind, '1. panel').toBe('unlocked');
    expect(tapPicture(second, 'car').kind, '2. panel, stejná omalovánka').toBe('open');

    expect(secondPage.keys.balance().wholeKeys, 'zbyl jeden klíč').toBe(1);
  });

  it('ve dvou panelech se klíčem odemkne nejvýš tolik omalovánek, kolik bylo celých klíčů', async () => {
    for (let keys = 0; keys <= 3; keys += 1) {
      const device = lockDevice();
      completeMaps(loadPage(device).keys, 2 * keys);
      const panels = [await enterColoring(loadPage(device)), await enterColoring(loadPage(device))];
      const choices = panels.map((locks) => choiceWith(locks));

      LOCKED_IDS.forEach((id, index) => {
        const panel = index % 2;
        const choice = choices[panel];
        if (choice === undefined) {
          return;
        }
        const tap = tapPicture(choice, id);
        if (tap.kind === 'unlocked') {
          paintAndReturn(choice);
        }
        for (const locks of panels) {
          const indicator = locks.keyIndicator();
          expect(indicator?.wholeKeys ?? 0, `${keys} klíčů, po ${id}`).toBeGreaterThanOrEqual(0);
        }
      });

      const reloaded = await enterColoring(loadPage(device));
      expect(LOCKED_IDS.length - lockedIdsOf(reloaded).length, `${keys} klíčů`).toBe(keys);
    }
  });
});

describe('#140 AC7: odemčení, které se nepodaří uložit', () => {
  it('nepovedené uložení odemčení platí do zavření stránky, po obnovení je omalovánka zamčená a klíč zpátky', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    // Od teď se do zařízení nic neuloží (plné úložiště), profil to drží v paměti stránky.
    device.storage.failWrite = () => true;
    const choice = choiceWith(locks);

    expect(tapPicture(choice, 'car').kind, 'dítě nevidí chybu, omalovánka se otevře').toBe(
      'unlocked',
    );
    paintAndReturn(choice);

    expect(tapPicture(choice, 'car').kind, 'po návratu na výběr').toBe('open');
    const again = await enterColoring(pageOfStore(page.store));
    expect(lockedIdsOf(again), 'další otevření na stejné stránce').not.toContain('car');

    device.storage.failWrite = () => false;
    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded), 'po obnovení zase zamčená').toEqual(LOCKED_IDS);
    expect(reloaded.keyIndicator(), 'po obnovení klíč zpátky').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });
});

describe('#140 AC2: album, velký obrázek a Malovat dál fungují se zámky jako dřív', () => {
  it('obrázek z alba jde otevřít velký a malovat dál, i když jeho omalovánka je zamčená', async () => {
    const page = loadPage(lockDevice());
    const locks = await enterColoring(page);
    // Obrázek zamčené omalovánky v albu (vyfocený až po odemčení zdarma, třeba v jiném panelu).
    await photograph(page, 'sea');
    expect(locks.isLocked(pictureOf('sea'))).toBe(true);
    const choice = choiceWithAlbum(page, locks);

    const album = await readAlbum(page.records, setPictures());
    expect(choice.tapBook(album).kind, 'kniha otevře album').toBe('open');
    expect(choice.tapAlbumPreview(0).kind, 'velký obrázek').toBe('open');
    choice.bigPictureShown();
    expect(choice.screen().kind).toBe('bigPicture');

    const tap = choice.tapContinue();
    expect(tap.kind, 'štětec začne výměnu').toBe('swapping');
    if (tap.kind !== 'swapping') {
      return;
    }
    const result = await tap.done;
    await settle();
    expect(result, 'malování moře se otevře').toEqual({
      kind: 'opened',
      picture: pictureOf('sea'),
    });
  });
});

/**
 * Obrys omalovánky se může nestáhnout (výpadek sítě). Scéna pak dá
 * odemčení zdarma (`unlockPaintedPictures`) jen omalovánky s obrysem.
 * Omalovánku bez obrysu nejde zkontrolovat, takže se klíčem odemknout
 * nesmí, dokud se nezkontroluje. Kontrola se dokončí při dalším otevření,
 * kdy obrysy jsou. Ťuknutí na takovou omalovánku klíč nevezme (výsledek
 * není `unlocked`).
 */
describe('#140 AC2: když se obrys nestáhne, rozmalovaná omalovánka se klíčem neplatí', () => {
  it('když se obrys jedné omalovánky nestáhne, rozmalované auto se klíčem neplatí', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'car');
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page, { missingOutlines: ['fish'] });

    const tap = tapPicture(choiceWith(locks), 'car');

    expect(tap.kind, 'auto se klíčem neodemkne').not.toBe('unlocked');
    expect(page.keys.balance().wholeKeys, 'klíč zůstane').toBe(1);
    expect(page.keys.spentItems(), 'nic se neutratilo').toEqual([]);
    const reopened = await enterColoring(loadPage(device));
    expect(reopened.isLocked(pictureOf('car')), 'auto je odemčené zdarma').toBe(false);
    expect(reopened.keyIndicator(), 'pořád jeden celý klíč').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
    expect(loadPage(device).keys.spentItems()).toEqual([]);
  });

  it('rozmalovaná omalovánka, jejíž obrys se nestáhl, se klíčem neplatí a odemkne se zdarma později', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'fish');
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page, { missingOutlines: ['fish'] });

    const tap = tapPicture(choiceWith(locks), 'fish');

    expect(tap.kind, 'rybka se klíčem neodemkne').not.toBe('unlocked');
    expect(page.keys.balance().wholeKeys, 'klíč zůstane').toBe(1);
    expect(page.keys.spentItems(), 'nic se neutratilo').toEqual([]);
    const reopened = await enterColoring(loadPage(device));
    expect(reopened.isLocked(pictureOf('fish')), 'rybka je odemčená zdarma').toBe(false);
    expect(reopened.keyIndicator(), 'pořád jeden celý klíč').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });
});
