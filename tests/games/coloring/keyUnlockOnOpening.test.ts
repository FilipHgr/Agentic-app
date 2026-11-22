import { describe, expect, it } from 'vitest';

import { KEY_WAIT_MS } from '../../../src/games/coloring/logic/pictureChoice';
import type { KeyInLockTap, PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import {
  advanceLockClock,
  completeMaps,
  enterColoring,
  loadPage,
  lockDevice,
  openColoringWhilePreparing,
  paintPage,
  pictureOf,
  sendKeyTo,
  tapPicture,
  choiceWith,
  previewIndexOf,
} from './pictureLocksHelpers';
import type { LockDevice, PreparingColoring } from './pictureLocksHelpers';

/**
 * Testy k #195 AC1 a AC2: klíč získaný v Počítání nebo ve Znaménkách
 * (2 dokončené mapy na společné mapě profilu, #193) odemkne omalovánku.
 *
 * Příčina chyby: výběr Omalovánek je vidět hned, ale klíč do zámku
 * pouštěl až po přípravě obrysů všech 16 omalovánek a přečtení alba (na
 * iPadu 6–11 s po každém otevření). Do té doby se zámek s klíčem jen
 * zhoupl jako bez klíče, takže dítě, které ťuklo hned, klíčem nic
 * neodemklo. Kontrola odemčení zdarma (#140 AC2) je přitom potřeba jen
 * jednou: omalovánka, jejíž stránka a obrázky v albu už jsou
 * zkontrolované, se odemyká klíčem hned.
 *
 * Hry s hvězdičkami hlásí dokončené mapy klíčům profilu (`completeMaps`,
 * jako mapa po 10 hvězdičkách); Omalovánky dostanou klíče stejně jako od
 * stránky (`loadPage`). Otevření se scénou, která ještě připravuje obrysy,
 * je `openColoringWhilePreparing`.
 */

describe('#195 AC1: celý klíč z her s hvězdičkami je v Omalovánkách vidět', () => {
  it('po dvou dokončených mapách ukazatel v Omalovánkách ukáže 1 celý klíč bez půlky', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 2);

    const locks = await enterColoring(loadPage(device));

    expect(locks.keyIndicator()).toEqual({ wholeKeys: 1, hasHalf: false });
  });

  it('ukazatel ukáže 1 klíč hned po otevření, i když se obrysy ještě připravují', () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 2);

    const { locks } = openColoringWhilePreparing(loadPage(device));

    expect(locks.keyIndicator()).toEqual({ wholeKeys: 1, hasHalf: false });
  });
});

describe('#195 AC2: klíč odemkne omalovánku hned po otevření Omalovánek', () => {
  it('dítě, které už Omalovánky otevřelo, odemkne omalovánku klíčem hned po dalším otevření', async () => {
    const device = lockDevice();
    await enterColoring(loadPage(device));
    completeMaps(loadPage(device).keys, 2);

    const page = loadPage(device);
    const { locks } = openColoringWhilePreparing(page);
    const choice = choiceWith(locks);

    expect(tapPicture(choice, 'car').kind, 'první ťuknutí pošle klíč do zámku').toBe('keyToLock');
    choice.keyLanded();
    expect(tapPicture(choice, 'car').kind, 'druhé ťuknutí odemkne').toBe('unlocked');
    expect(locks.isLocked(pictureOf('car')), 'auto je odemčené').toBe(false);
    expect(locks.keyIndicator(), 'klíč se utratil').toEqual({ wholeKeys: 0, hasHalf: false });
    expect(page.keys.spentItems()).toEqual(['coloring/car']);
  });

  it('omalovánka odemčená hned po otevření zůstane odemčená po přípravě obrysů, po návratu i po obnovení stránky', async () => {
    const device = lockDevice();
    await enterColoring(loadPage(device));
    completeMaps(loadPage(device).keys, 2);
    const opened = openColoringWhilePreparing(loadPage(device));
    const choice = choiceWith(opened.locks);
    sendKeyTo(choice, 'car');
    tapPicture(choice, 'car');

    await opened.finishPreparing();
    expect(opened.locks.isLocked(pictureOf('car')), 'po přípravě obrysů').toBe(false);

    const reloaded = openColoringWhilePreparing(loadPage(device));
    expect(reloaded.locks.isLocked(pictureOf('car')), 'po obnovení stránky').toBe(false);
    expect(reloaded.locks.keyIndicator(), 'klíč se nevrátil').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
    const reloadedChoice = choiceWith(reloaded.locks);
    expect(tapPicture(reloadedChoice, 'car').kind, 'otevře se bez klíče').toBe('open');
  });

  it('když se obrysy připraví až mezi prvním a druhým ťuknutím, klíč omalovánku odemkne', async () => {
    const device = lockDevice();
    await enterColoring(loadPage(device));
    completeMaps(loadPage(device).keys, 2);
    const opened = openColoringWhilePreparing(loadPage(device));
    const choice = choiceWith(opened.locks);

    sendKeyTo(choice, 'fish');
    await opened.finishPreparing();

    expect(tapPicture(choice, 'fish').kind).toBe('unlocked');
  });
});

/**
 * Úplně první otevření Omalovánek v profilu: odemčení zdarma ještě nikdy
 * neproběhlo a scéna na ně čeká (6–11 s). Klíč přesto hned reaguje
 * (upřesnění #195): vyletí do zámku a poskakuje v něm, druhé ťuknutí se
 * zapamatuje a rozhodne se, až kontrola doběhne. Scéna pak hlásí
 * `freeCheckFinished` (jako `keyLanded` po doletu).
 */
interface FirstOpening {
  readonly device: LockDevice;
  readonly opened: PreparingColoring;
  readonly choice: PictureChoice;
}

/** Profil s celým klíčem otevře Omalovánky poprvé; `painted` má rozmalované stránky z doby před zámky. */
function openFirstTime(painted: readonly string[] = []): FirstOpening {
  const device = lockDevice();
  const page = loadPage(device);
  completeMaps(page.keys, 2);
  for (const id of painted) {
    paintPage(page, id);
  }
  const opened = openColoringWhilePreparing(loadPage(device));
  return { device, opened, choice: choiceWith(opened.locks) };
}

/** Kontrola doběhne a scéna to výběru oznámí; vrátí, co se stalo se zapamatovaným ťuknutím. */
async function finishCheck(first: FirstOpening): Promise<KeyInLockTap | null> {
  await first.opened.finishPreparing();
  return first.choice.freeCheckFinished();
}

function spentOf(first: FirstOpening): readonly string[] {
  return loadPage(first.device).keys.spentItems();
}

describe('#195 upřesnění: při první kontrole odemčení zdarma klíč hned reaguje', () => {
  it('první ťuknutí pošle klíč do zámku hned, i když kontrola ještě běží', () => {
    const first = openFirstTime();

    expect(tapPicture(first.choice, 'fish')).toMatchObject({
      kind: 'keyToLock',
      index: previewIndexOf('fish'),
      from: null,
    });
    first.choice.keyLanded();
    expect(first.choice.keyInLock(), 'klíč je v zámku').toMatchObject({
      picture: pictureOf('fish'),
      landed: true,
    });
    expect(spentOf(first), 'nic se neutratilo').toEqual([]);
  });

  it('druhé ťuknutí během kontroly se zapamatuje, klíč zůstane v zámku a nic se neutratí', () => {
    const first = openFirstTime();
    sendKeyTo(first.choice, 'fish');

    expect(tapPicture(first.choice, 'fish')).toMatchObject({
      kind: 'keyWaits',
      index: previewIndexOf('fish'),
    });
    expect(first.choice.keyInLock(), 'klíč dál čeká v zámku').toMatchObject({
      picture: pictureOf('fish'),
      landed: true,
    });
    expect(first.choice.screen(), 'zůstane výběr').toEqual({ kind: 'picker' });
    expect(spentOf(first), 'nic se neutratilo').toEqual([]);
    expect(first.opened.locks.keyIndicator(), 'klíč pořád patří dítěti').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });

  it('zapamatované ťuknutí omalovánku odemkne klíčem hned, jak kontrola doběhne', async () => {
    const first = openFirstTime();
    sendKeyTo(first.choice, 'fish');
    tapPicture(first.choice, 'fish');

    expect(await finishCheck(first)).toMatchObject({
      kind: 'unlocked',
      index: previewIndexOf('fish'),
      picture: pictureOf('fish'),
    });
    expect(first.choice.screen()).toEqual({ kind: 'opening', picture: pictureOf('fish') });
    expect(spentOf(first)).toEqual(['coloring/fish']);
    expect(first.opened.locks.keyIndicator()).toEqual({ wholeKeys: 0, hasHalf: false });
  });

  it('omalovánka, která je zdarma, se po kontrole otevře bez klíče a klíč se vrátí nespotřebovaný', async () => {
    const first = openFirstTime(['car']);
    sendKeyTo(first.choice, 'car');
    expect(tapPicture(first.choice, 'car').kind).toBe('keyWaits');

    expect(await finishCheck(first)).toMatchObject({
      kind: 'open',
      index: previewIndexOf('car'),
      picture: pictureOf('car'),
    });
    expect(first.choice.keyInLock(), 'klíč je zpátky v ukazateli').toBeNull();
    expect(spentOf(first), 'nic se neutratilo').toEqual([]);
    expect(first.opened.locks.isLocked(pictureOf('car')), 'auto je odemčené zdarma').toBe(false);
    expect(first.opened.locks.keyIndicator(), 'klíč zůstal').toEqual({
      wholeKeys: 1,
      hasHalf: false,
    });
  });

  it('klíč v zámku omalovánky zdarma se po kontrole vrátí i bez druhého ťuknutí', async () => {
    const first = openFirstTime(['car']);
    sendKeyTo(first.choice, 'car');

    expect(await finishCheck(first)).toBeNull();
    expect(first.choice.keyInLock()).toBeNull();
    expect(spentOf(first)).toEqual([]);
    expect(tapPicture(first.choice, 'car').kind, 'auto se otevře bez klíče').toBe('open');
  });

  it('bez druhého ťuknutí klíč po kontrole zůstane v zámku a další ťuknutí omalovánku odemkne', async () => {
    const first = openFirstTime();
    sendKeyTo(first.choice, 'fish');

    expect(await finishCheck(first)).toBeNull();
    expect(first.choice.keyInLock(), 'klíč čeká v zámku').toMatchObject({
      picture: pictureOf('fish'),
    });
    expect(tapPicture(first.choice, 'fish').kind).toBe('unlocked');
    expect(spentOf(first)).toEqual(['coloring/fish']);
  });

  it('během kontroly se klíč z zámku nevrátí ani po dlouhé době a 5 s začne až po kontrole', async () => {
    const first = openFirstTime();
    sendKeyTo(first.choice, 'fish');

    advanceLockClock(4 * KEY_WAIT_MS);
    expect(first.choice.keyInLock(), 'během kontroly klíč čeká').not.toBeNull();

    await finishCheck(first);
    advanceLockClock(KEY_WAIT_MS - 100);
    expect(first.choice.keyInLock(), 'těsně před 5 s po kontrole').not.toBeNull();
    advanceLockClock(100);
    expect(first.choice.keyInLock(), '5 s po kontrole se klíč vrátí').toBeNull();
    expect(spentOf(first)).toEqual([]);
  });

  it('bez celého klíče se zámek během kontroly jen zhoupne jako dřív', () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 1);
    const opened = openColoringWhilePreparing(loadPage(device));

    expect(tapPicture(choiceWith(opened.locks), 'fish')).toEqual({
      kind: 'locked',
      index: previewIndexOf('fish'),
      tones: HOME_WOBBLE_TONES,
    });
  });

  it('ťuknutí jinam během kontroly klíč vrátí a zapamatované ťuknutí zapomene', async () => {
    const first = openFirstTime();
    sendKeyTo(first.choice, 'fish');
    tapPicture(first.choice, 'fish');

    expect(tapPicture(first.choice, 'cat').kind, 'kočka se otevře').toBe('open');
    expect(first.choice.keyInLock()).toBeNull();
    expect(await finishCheck(first)).toBeNull();
    expect(spentOf(first), 'nic se neutratilo').toEqual([]);
  });
});
