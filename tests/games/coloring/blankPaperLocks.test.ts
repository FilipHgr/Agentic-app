import { describe, expect, it } from 'vitest';

import { PAPER } from './realPicturesHelpers';
import {
  FREE_IDS,
  LOCKED_IDS,
  THROWING_KEYS,
  choiceWith,
  completeMaps,
  damageWritesSince,
  enterColoring,
  loadPage,
  lockDevice,
  lockedIdsOf,
  paintPage,
  snapshotOf,
  unlockByTap,
} from './pictureLocksHelpers';

/**
 * Testy k #151 AC1: papír není nikdy zamčený, ani když je záznam zámků
 * nečitelný (#140 AC7), a nepočítá se do zámků ani do ukazatele klíčů.
 * Staví na pomůckách testů #140 (`pictureLocksHelpers.ts`): skutečná sada
 * (`COLORING_PICTURES`, od #151 s papírem na 1. místě), zámky nad
 * úložištěm hry aktivního profilu a klíči z Počítání.
 *
 * „Nepočítá se do zámků“ znamená: odemčené od začátku zůstanou domek,
 * kočka a pejsek (papír není jedním ze tří), zamčených je dál 8 omalovánek,
 * papír klíč nebere a nevrací a ukazatel klíčů kvůli papíru nezůstane vidět.
 *
 * Navržené rozhraní: žádné nové, `openPictureLocks` jen papír nikdy
 * nezamkne (viz `blankPaper.test.ts`).
 */

describe('#151 AC1: papír není nikdy zamčený', () => {
  it('nový profil má papír odemčený a ťuknutí ho otevře bez klíče', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);

    expect(locks.isLocked(PAPER)).toBe(false);
    const choice = choiceWith(locks);
    expect(choice.tapPreview(0)).toMatchObject({ kind: 'open', index: 0, picture: PAPER });
    expect(page.keys.balance(), 'klíč zůstal').toEqual({ halves: 2, wholeKeys: 1, hasHalf: false });
  });

  it('bez klíčů od stránky i s klíči, které selhávají, je papír odemčený a otevře se', async () => {
    for (const [what, keys] of [
      ['stránka klíče nedala', undefined],
      ['klíče vyhazují výjimku', THROWING_KEYS],
    ] as const) {
      const locks = await enterColoring(loadPage(lockDevice()), { keys });
      expect(locks.isLocked(PAPER), what).toBe(false);
      expect(choiceWith(locks).tapPreview(0), what).toMatchObject({ kind: 'open', picture: PAPER });
    }
  });

  it('s nečitelným záznamem zámků je papír dál odemčený a otevře se', async () => {
    const device = lockDevice();
    const before = snapshotOf(device);
    const page = loadPage(device);
    paintPage(page, 'car');
    paintPage(page, 'paper');
    completeMaps(page.keys, 2);
    unlockByTap(choiceWith(await enterColoring(page)), 'fish');
    const damaged = damageWritesSince(device, before);
    expect(damaged.length, 'kontrola: záznamy se poškodily').toBeGreaterThan(0);

    const locks = await enterColoring(loadPage(device));

    expect(locks.isLocked(PAPER)).toBe(false);
    expect(choiceWith(locks).tapPreview(0)).toMatchObject({ kind: 'open', picture: PAPER });
  });
});

describe('#151 AC1: papír se nepočítá do zámků ani do ukazatele klíčů', () => {
  it('odemčené od začátku jsou dál domek, kočka a pejsek a zamčených je 8 omalovánek', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(LOCKED_IDS.length).toBe(8);
    for (const id of FREE_IDS) {
      expect(locks.isLocked({ id, version: 1 }), id).toBe(false);
    }
  });

  it('odemčení papíru klíčem nic neutratí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page);
    const before = page.keys.balance();

    expect(locks.unlock(PAPER)).toBe('alreadyUnlocked');

    expect(page.keys.balance()).toEqual(before);
  });

  it('rozmalovaný papír žádnou omalovánku neodemkne a klíče nezmění', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 3);
    const before = page.keys.balance();
    paintPage(page, 'paper');

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(page.keys.balance()).toEqual(before);
  });

  it('když dítě odemkne klíči všech 8 zamčených omalovánek, ukazatel klíčů zmizí, i když je v sadě papír', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, LOCKED_IDS.length * 2);
    const locks = await enterColoring(page);
    expect(locks.keyIndicator(), 'kontrola: se zamčenými je ukazatel vidět').not.toBeNull();
    const choice = choiceWith(locks);

    for (const id of LOCKED_IDS) {
      unlockByTap(choice, id);
    }

    expect(lockedIdsOf(locks)).toEqual([]);
    expect(locks.keyIndicator()).toBeNull();
  });

  it('ukazatel klíčů ukazuje stejný počet klíčů jako bez papíru: otevření papíru ho nezmění', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 3);
    const locks = await enterColoring(page);
    const before = locks.keyIndicator();
    expect(before).toEqual({ wholeKeys: 1, hasHalf: true });

    expect(choiceWith(locks).tapPreview(0)).toMatchObject({ kind: 'open', picture: PAPER });

    expect(locks.keyIndicator()).toEqual(before);
  });
});
