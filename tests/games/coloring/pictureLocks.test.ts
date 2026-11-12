import { describe, expect, it } from 'vitest';

import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import {
  FREE_IDS,
  LOCKED_IDS,
  THROWING_KEYS,
  UNAVAILABLE_ALBUM,
  choiceWith,
  clearPage,
  colorOnlyPage,
  completeMaps,
  damageWritesSince,
  enterColoring,
  loadPage,
  lockDevice,
  lockedIdsOf,
  pageOfStore,
  paintPage,
  photograph,
  pictureOf,
  removeFromAlbum,
  snapshotOf,
  tapPicture,
  unlockByTap,
} from './pictureLocksHelpers';

/**
 * Testy k #140 AC1 (výchozí zámky), AC2 (nic se neztratí), AC3 (ukazatel
 * klíčů, logika) a AC7 (nečitelný záznam, klíče od stránky chybí). Ťuknutí
 * na zamčenou omalovánku (AC4–AC6) a nepovedené uložení odemčení (AC7)
 * testuje `pictureLockTaps.test.ts`, rozložení ukazatele
 * `keyIndicatorLayoutRules.test.ts`, utrácení klíčů ve sdílené části
 * `tests/shared/keySpending.test.ts`.
 *
 * Navržené rozhraní `src/games/coloring/logic/pictureLocks.ts` (čistý TS):
 * - `openPictureLocks({ pictures, storage, keyRewards }): PictureLocks`
 *   nad úložištěm hry aktivního profilu a klíči od stránky
 *   (`GameHost.keyRewards`, bez nich 0 klíčů),
 * - `PictureLocks.isLocked(picture): boolean`,
 * - `PictureLocks.keyIndicator(): { wholeKeys: number; hasHalf: boolean } | null`
 *   (`null`, když není zamčená žádná omalovánka: ukazatel zmizí),
 * - `PictureLocks.unlock(picture): 'unlocked' | 'alreadyUnlocked' | 'noKey'`
 *   (volá ho výběr při ťuknutí, testy ho volají přes výběr),
 * - `unlockPaintedPictures({ storage, pictures, album }): void` jednorázové
 *   odemčení zdarma podle stránek s tahem a obrázků v albu (AC2); když
 *   album nejde přečíst, dokončí se při dalším otevření.
 *
 * Omalovánka se odemyká podle označení (`id`), ne verze obrysu, aby změna
 * obrysu odemčenou omalovánku nezamkla.
 */

describe('#140 AC1: nový profil má odemčené první 3 omalovánky', () => {
  it('nový profil má odemčený domek, kočku a pejska, ostatních 8 je zamčených', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    for (const id of FREE_IDS) {
      expect(locks.isLocked(pictureOf(id)), id).toBe(false);
    }
  });

  it('sada má 11 omalovánek a odemčené jsou první 3 v pořadí náhledů', () => {
    expect(COLORING_PICTURES.map((picture) => picture.id)).toEqual([...FREE_IDS, ...LOCKED_IDS]);
  });

  it('profil, který hrál jen Počítání, má odemčené jen první 3 a klíče mu zůstanou', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 5);

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(page.keys.balance(), 'klíče se samy neutratí').toEqual({
      halves: 5,
      wholeKeys: 2,
      hasHalf: true,
    });
  });

  it('zamčené omalovánky jsou na výběru dál vidět', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    expect(choiceWith(locks).previews()).toEqual(COLORING_PICTURES);
  });

  it('zámky patří profilu: odemčení v jednom profilu jiný profil nevidí', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    const first = page.store.activeProfile();
    const ema = page.store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.store.selectProfile(ema.id);
    const emaPage = pageOfStore(page.store);
    completeMaps(emaPage.keys, 2);
    unlockByTap(choiceWith(await enterColoring(emaPage)), 'car');

    page.store.selectProfile(first.id);
    const firstLocks = await enterColoring(pageOfStore(page.store));

    expect(lockedIdsOf(firstLocks)).toEqual(LOCKED_IDS);
  });
});

describe('#140 AC2: rozmalované omalovánky a obrázky v albu zůstanou odemčené', () => {
  it('omalovánka s rozmalovanou stránkou se při prvním otevření odemkne', async () => {
    const page = loadPage(lockDevice());
    paintPage(page, 'car');
    paintPage(page, 'unicorn');

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS.filter((id) => id !== 'car' && id !== 'unicorn'));
  });

  it('omalovánka s obrázkem v albu se při prvním otevření odemkne', async () => {
    const page = loadPage(lockDevice());
    await photograph(page, 'fish');

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS.filter((id) => id !== 'fish'));
  });

  it('stránka jen s vybranou barvou, bez tahu, omalovánku neodemkne', async () => {
    const page = loadPage(lockDevice());
    colorOnlyPage(page, 'sea');

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
  });

  it('odemčení zdarma platí natrvalo, i když dítě stránku nebo obrázek smaže', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'car');
    await photograph(page, 'fish');
    await enterColoring(page);

    clearPage(page, 'car');
    await removeFromAlbum(page, 'fish');

    const again = await enterColoring(page);
    expect(lockedIdsOf(again), 'další otevření').not.toContain('car');
    expect(lockedIdsOf(again), 'další otevření').not.toContain('fish');
    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded), 'po obnovení stránky').toEqual(
      LOCKED_IDS.filter((id) => id !== 'car' && id !== 'fish'),
    );
  });

  it('odemčení zdarma proběhne jen jednou, při prvním otevření po změně', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    await enterColoring(page);

    // Stránka zamčené omalovánky by mohla vzniknout jen mimo výběr (starší verze hry v jiném panelu).
    paintPage(page, 'sea');

    const reloaded = await enterColoring(loadPage(device));
    expect(lockedIdsOf(reloaded)).toEqual(LOCKED_IDS);
  });

  it('odemčení zdarma žádný klíč nebere: s rozmalovaným autem a dvěma půlkami je jeden celý klíč', async () => {
    const page = loadPage(lockDevice());
    paintPage(page, 'car');
    completeMaps(page.keys, 2);

    const locks = await enterColoring(page);

    expect(lockedIdsOf(locks)).not.toContain('car');
    expect(locks.keyIndicator()).toEqual({ wholeKeys: 1, hasHalf: false });
    expect(page.keys.balance().wholeKeys).toBe(1);
  });

  it('i když dítě otevře nejdřív Omalovánky a až potom Počítání, má jeden celý klíč', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'car');

    const locks = await enterColoring(page);
    expect(locks.keyIndicator(), 'před Počítáním').toEqual({ wholeKeys: 0, hasHalf: false });
    completeMaps(loadPage(device).keys, 2);

    expect(locks.keyIndicator(), 'po Počítání, stejný výběr').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
    const reopened = await enterColoring(loadPage(device));
    expect(reopened.keyIndicator(), 'další otevření Omalovánek').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
    expect(lockedIdsOf(reopened)).not.toContain('car');
  });

  it('když album při prvním otevření nejde přečíst, odemkne se omalovánka z alba při dalším otevření', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'car');
    await photograph(page, 'fish');

    const first = await enterColoring(page, { records: UNAVAILABLE_ALBUM });
    expect(lockedIdsOf(first), 'stránka se odemkne hned').not.toContain('car');

    const second = await enterColoring(loadPage(device));
    expect(lockedIdsOf(second), 'obrázek z alba se neztratí').toEqual(
      LOCKED_IDS.filter((id) => id !== 'car' && id !== 'fish'),
    );
  });
});

describe('#140 AC3: ukazatel klíčů ukáže celé klíče a půlku', () => {
  it('ukazatel ukáže počet celých klíčů a jestli má dítě i půlku', async () => {
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

  it('po odemčení klíčem ukazatel ukáže zbylé celé klíče a půlka zůstane', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 5);
    const locks = await enterColoring(page);

    unlockByTap(choiceWith(locks), 'car');

    expect(locks.keyIndicator()).toEqual({ wholeKeys: 1, hasHalf: true });
  });

  it('když není zamčená žádná omalovánka, ukazatel zmizí a klíče se schovají na později', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 2 * LOCKED_IDS.length + 3);
    const locks = await enterColoring(page);
    const choice = choiceWith(locks);

    for (const id of LOCKED_IDS) {
      expect(locks.keyIndicator(), `před odemčením ${id}`).not.toBeNull();
      unlockByTap(choice, id);
    }

    expect(lockedIdsOf(locks)).toEqual([]);
    expect(locks.keyIndicator()).toBeNull();
    expect(page.keys.balance(), 'zbylý klíč a půlka zůstanou').toEqual({
      halves: 2 * LOCKED_IDS.length + 3,
      wholeKeys: 1,
      hasHalf: true,
    });
  });

  it('když jsou všechny omalovánky odemčené zdarma, ukazatel se vůbec neukáže', async () => {
    const page = loadPage(lockDevice());
    for (const id of LOCKED_IDS) {
      paintPage(page, id);
    }

    const locks = await enterColoring(page);

    expect(locks.keyIndicator()).toBeNull();
  });
});

describe('#140 AC7: nečitelný záznam a chybějící klíče hru nezastaví', () => {
  it('nečitelný záznam odemčení dá jen výchozí 3 omalovánky a ty z AC2, klíč je zpátky', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'car');
    await photograph(page, 'fish');
    completeMaps(page.keys, 2);
    const before = snapshotOf(device);
    const locks = await enterColoring(page);
    unlockByTap(choiceWith(locks), 'unicorn');

    expect(damageWritesSince(device, before).length, 'odemykání něco zapsalo').toBeGreaterThan(0);

    const reloaded = loadPage(device);
    const damaged = await enterColoring(reloaded);
    expect(lockedIdsOf(damaged)).toEqual(LOCKED_IDS.filter((id) => id !== 'car' && id !== 'fish'));
    expect(damaged.keyIndicator(), 'klíč za jednorožce je zpátky').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });

  it('nečitelné úložiště hry dá výchozí 3 omalovánky bez chyby', async () => {
    const device = lockDevice();
    device.storage.failReads = true;
    device.storage.failWrite = () => true;

    const locks = await enterColoring(loadPage(device));

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(locks.keyIndicator()).toEqual({ wholeKeys: 0, hasHalf: false });
  });

  it('když stránka hře klíče nepředá, má dítě 0 klíčů a zámky platí', async () => {
    const page = loadPage(lockDevice());
    completeMaps(page.keys, 4);

    const locks = await enterColoring(page, { keys: undefined });

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(locks.keyIndicator()).toEqual({ wholeKeys: 0, hasHalf: false });
    expect(tapPicture(choiceWith(locks), 'car').kind, 'auto se neodemkne').toBe('locked');
  });

  it('bez klíčů od stránky se rozmalované omalovánky odemknou dál zdarma', async () => {
    const page = loadPage(lockDevice());
    paintPage(page, 'car');

    const locks = await enterColoring(page, { keys: undefined });

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
  });

  it('klíče, které vyhodí výjimku, jsou 0 klíčů a hráč nevidí chybu', async () => {
    const locks = await enterColoring(loadPage(lockDevice()), { keys: THROWING_KEYS });

    expect(lockedIdsOf(locks)).toEqual(LOCKED_IDS);
    expect(locks.keyIndicator()).toEqual({ wholeKeys: 0, hasHalf: false });
    expect(() => tapPicture(choiceWith(locks), 'car')).not.toThrow();
  });
});
