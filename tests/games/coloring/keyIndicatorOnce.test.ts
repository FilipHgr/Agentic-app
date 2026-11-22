import { describe, expect, it } from 'vitest';

import { keyIndicatorLook } from '../../../src/games/coloring/logic/pictureLocks';
import type {
  KeyIndicatorLook,
  KeyIndicatorState,
  PictureLocks,
} from '../../../src/games/coloring/logic/pictureLocks';
import type { PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import {
  choiceWith,
  completeMaps,
  enterColoring,
  loadPage,
  lockDevice,
  paintAndReturn,
  sendKeyTo,
  tapPicture,
} from './pictureLocksHelpers';

/**
 * Testy k #195 AC3 a AC4: klíč je ve výběru Omalovánek vidět jen jednou.
 *
 * Příčina chyby: ukazatel vedle zlatého klíče s číslicí kreslil vždy
 * i prázdný obrys celého klíče (postup k dalšímu klíči, #159 AC1), takže
 * s jedním klíčem byly vidět dva klíče. Za letu do zámku zůstal
 * v ukazateli ztlumený zlatý klíč a s letícím byly zase dva.
 *
 * Ukazatel kreslí, co vrátí `keyIndicatorLook` (stav klíčů a jestli je
 * klíč mimo ukazatel, jako `KeyIndicatorView` podle klíče v zámku). Dítě
 * vidí: hlavní klíč (`gold` zlatý, `half` obrys se zlatou hlavou, `empty`
 * šedý obrys), číslici a půlku vedle zlatého klíče. Klíč mimo
 * ukazatel je jeden zlatý klíč navíc.
 */

/** Kolik celých zlatých klíčů dítě na výběru vidí (v ukazateli a mimo něj). */
function goldKeysSeen(look: KeyIndicatorLook, keyOut: boolean): number {
  return (look.mainKey === 'gold' ? 1 : 0) + (keyOut ? 1 : 0);
}

/** Kolik obrysů klíče (s hlavou i bez) dítě v ukazateli vidí. */
function outlinesSeen(look: KeyIndicatorLook): number {
  const mainOutline = look.mainKey === 'half' || look.mainKey === 'empty' ? 1 : 0;
  return mainOutline + (look.halfBeside ? 1 : 0);
}

/** Kolik půlek (obrys se zlatou hlavou) dítě v ukazateli vidí. */
function halvesSeen(look: KeyIndicatorLook): number {
  return (look.mainKey === 'half' ? 1 : 0) + (look.halfBeside ? 1 : 0);
}

/** Stavy klíčů od 0 do 3 celých klíčů s půlkou i bez ní. */
const STATES: readonly KeyIndicatorState[] = [0, 1, 2, 3].flatMap((wholeKeys) => [
  { wholeKeys, hasHalf: false },
  { wholeKeys, hasHalf: true },
]);

function describeState(state: KeyIndicatorState, keyOut: boolean): string {
  const half = state.hasHalf ? ' a půlka' : '';
  const out = keyOut ? ', jeden klíč mimo ukazatel' : '';
  return `${state.wholeKeys} celých${half}${out}`;
}

/** Výběr, kde dítě dokončilo `maps` map. */
async function pickerAfterMaps(
  maps: number,
): Promise<{ readonly choice: PictureChoice; readonly locks: PictureLocks }> {
  const page = loadPage(lockDevice());
  completeMaps(page.keys, maps);
  const locks = await enterColoring(page);
  return { choice: choiceWith(locks), locks };
}

/** Co dítě vidí na výběru: vzhled ukazatele podle stavu a klíče v zámku. */
function lookOf(choice: PictureChoice, locks: PictureLocks): KeyIndicatorLook {
  const state = locks.keyIndicator();
  if (state === null) {
    throw new Error('ukazatel klíčů není vidět');
  }
  return keyIndicatorLook(state, choice.keyInLock() !== null);
}

describe('#195 AC3: klíč je ve výběru vidět jen jednou', () => {
  it('s jedním celým klíčem ukazatel ukáže jeden zlatý klíč s číslicí 1 a žádný další obrys', async () => {
    const { choice, locks } = await pickerAfterMaps(2);

    expect(lookOf(choice, locks)).toEqual({ mainKey: 'gold', wholeKeys: 1, halfBeside: false });
  });

  it('s celými klíči bez půlky ukazatel nikdy neukáže obrys klíče navíc', () => {
    for (const state of STATES.filter((each) => each.wholeKeys > 0 && !each.hasHalf)) {
      const look = keyIndicatorLook(state, false);
      expect(outlinesSeen(look), describeState(state, false)).toBe(0);
      expect(goldKeysSeen(look, false), describeState(state, false)).toBe(1);
    }
  });

  it('za letu do zámku je s jedním klíčem zlatý jen ten letící a ukazatel ukáže šedý obrys s 0', async () => {
    const { choice, locks } = await pickerAfterMaps(2);

    tapPicture(choice, 'car');
    const flying = lookOf(choice, locks);
    expect(flying, 'za letu').toEqual({ mainKey: 'empty', wholeKeys: 0, halfBeside: false });
    expect(goldKeysSeen(flying, true), 'za letu jen letící klíč').toBe(1);

    choice.keyLanded();
    expect(lookOf(choice, locks), 'v zámku').toEqual(flying);
  });

  it('klíč mimo ukazatel ukazatel nepočítá a zlatých klíčů je vidět tolik, kolik jich dítě má', () => {
    for (const state of STATES.filter((each) => each.wholeKeys > 0)) {
      const look = keyIndicatorLook(state, true);
      const name = describeState(state, true);
      expect(look.wholeKeys, `${name}: číslice`).toBe(state.wholeKeys - 1);
      expect(goldKeysSeen(look, true), `${name}: zlaté klíče`).toBe(Math.min(state.wholeKeys, 2));
      // Bez zbylého klíče je v ukazateli jeden obrys (prázdný, nebo půlka), jinak jen půlka.
      const outlines = state.hasHalf || state.wholeKeys === 1 ? 1 : 0;
      expect(outlinesSeen(look), `${name}: obrysy`).toBe(outlines);
    }
  });

  it('číslice 0 není nikdy sama: vždy je u ní šedý obrys nebo půlka', () => {
    for (const state of STATES) {
      for (const keyOut of [false, true]) {
        const look = keyIndicatorLook(state, keyOut);
        if (look.wholeKeys === 0) {
          expect(look.mainKey, describeState(state, keyOut)).not.toBe('gold');
          expect(outlinesSeen(look), describeState(state, keyOut)).toBe(1);
        }
      }
    }
  });

  it('s posledním klíčem venku ukazatel vypadá stejně jako po jeho utracení', () => {
    for (const hasHalf of [false, true]) {
      expect(keyIndicatorLook({ wholeKeys: 1, hasHalf }, true)).toEqual(
        keyIndicatorLook({ wholeKeys: 0, hasHalf }, false),
      );
    }
  });

  it('když se klíč vrátí do ukazatele, ukazatel ukáže zase jeden zlatý klíč s číslicí 1', async () => {
    const { choice, locks } = await pickerAfterMaps(2);
    sendKeyTo(choice, 'car');

    tapPicture(choice, 'cat');

    expect(lookOf(choice, locks)).toEqual({ mainKey: 'gold', wholeKeys: 1, halfBeside: false });
  });

  it('po odemčení ukazatel ukáže 0 klíčů jen šedým obrysem a žádný zlatý klíč', async () => {
    const { choice, locks } = await pickerAfterMaps(2);
    sendKeyTo(choice, 'car');
    tapPicture(choice, 'car');

    const look = lookOf(choice, locks);
    expect(look).toEqual({ mainKey: 'empty', wholeKeys: 0, halfBeside: false });
    expect(goldKeysSeen(look, false)).toBe(0);
  });
});

describe('#195 AC4: půlka jako půlka, celý klíč jako celý', () => {
  it('jedna dokončená mapa ukáže půlku a číslici 0, žádný zlatý klíč', async () => {
    const { choice, locks } = await pickerAfterMaps(1);

    expect(lookOf(choice, locks)).toEqual({ mainKey: 'half', wholeKeys: 0, halfBeside: false });
  });

  it('tři dokončené mapy ukážou jeden zlatý klíč s číslicí 1 a vedle půlku', async () => {
    const { choice, locks } = await pickerAfterMaps(3);

    expect(lookOf(choice, locks)).toEqual({ mainKey: 'gold', wholeKeys: 1, halfBeside: true });
  });

  it('půlka je vidět právě tehdy, když ji dítě má, a nikdy dvakrát', () => {
    for (const state of STATES) {
      for (const keyOut of [false, true]) {
        const look = keyIndicatorLook(state, keyOut);
        expect(halvesSeen(look), describeState(state, keyOut)).toBe(state.hasHalf ? 1 : 0);
      }
    }
  });

  it('ukazatel je stejný po návratu z malování i po obnovení stránky', async () => {
    const device = lockDevice();
    completeMaps(loadPage(device).keys, 3);
    const locks = await enterColoring(loadPage(device));
    const choice = choiceWith(locks);
    const before = lookOf(choice, locks);

    tapPicture(choice, 'cat');
    paintAndReturn(choice);
    const reloadedLocks = await enterColoring(loadPage(device));

    expect(lookOf(choice, locks), 'po návratu').toEqual(before);
    expect(lookOf(choiceWith(reloadedLocks), reloadedLocks), 'po obnovení stránky').toEqual(before);
  });
});
