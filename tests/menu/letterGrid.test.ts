import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCENT_LETTERS,
  BASE_LETTERS,
  MAX_NICKNAME_LENGTH,
  letterKeys,
} from '../../src/menu/logic/letterGrid';
import { isNickname } from '../../src/shared/logic/profiles';
import { tapAdd, testProfileScreens, typeNickname } from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #72 AC3 (mřížka písmen) a AC5 (fyzická klávesnice) bez
 * rozložení; rozložení je v `profileFormLayout.test.ts`.
 *
 * Navržené rozhraní:
 * - `src/menu/logic/letterGrid.ts`: `BASE_LETTERS` (A–Z), `ACCENT_LETTERS`
 *   (Á Č Ď É Ě Í Ň Ó Ř Š Ť Ú Ů Ý Ž), `MAX_NICKNAME_LENGTH` (12),
 *   `LetterLayer` (`'base' | 'accents'`) a `letterKeys(layer)`: klávesy
 *   vrstvy v pořadí mřížky, `{ kind: 'letter', letter }`, `{ kind: 'switch' }`
 *   a `{ kind: 'backspace' }`,
 * - `ProfileScreens` v 1. kroku: `tapLetter(letter)` (písmeno z ukázané
 *   vrstvy), `tapLayerSwitch()`, `tapBackspace()` a `keyDown(key)` s hodnotou
 *   `KeyboardEvent.key` („a“, „š“, „Backspace“, …),
 * - odezva: `{ kind: 'press', key: <písmeno> }`, zhoupnutí ⌫
 *   `{ kind: 'wobble', target: 'backspace' }`, zatřesení pole
 *   `{ kind: 'shake', target: 'field' }`.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const CZECH_ACCENTS = ['Á', 'Č', 'Ď', 'É', 'Ě', 'Í', 'Ň', 'Ó', 'Ř', 'Š', 'Ť', 'Ú', 'Ů', 'Ý', 'Ž'];
const FIELD_SHAKE = { kind: 'shake', target: 'field' } as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Výběr profilu s otevřeným 1. krokem formuláře. */
function nicknameStep(): TestProfileScreens {
  const test = testProfileScreens();
  tapAdd(test.screens);
  return test;
}

function lettersOf(layer: 'base' | 'accents'): string[] {
  return letterKeys(layer).flatMap((key) => (key.kind === 'letter' ? [key.letter] : []));
}

function countOf(layer: 'base' | 'accents', kind: 'switch' | 'backspace'): number {
  return letterKeys(layer).filter((key) => key.kind === kind).length;
}

describe('#72 AC3: mřížka má dvě vrstvy', () => {
  it('základní vrstva má 26 písmen A–Z abecedně, přepínač a smazání', () => {
    expect([...BASE_LETTERS]).toEqual(ALPHABET);
    expect(lettersOf('base')).toEqual(ALPHABET);
    expect(countOf('base', 'switch')).toBe(1);
    expect(countOf('base', 'backspace')).toBe(1);
    expect(letterKeys('base')).toHaveLength(28);
  });

  it('vrstva diakritiky má Á Č Ď É Ě Í Ň Ó Ř Š Ť Ú Ů Ý Ž, přepínač a smazání', () => {
    expect([...ACCENT_LETTERS]).toEqual(CZECH_ACCENTS);
    expect(lettersOf('accents')).toEqual(CZECH_ACCENTS);
    expect(countOf('accents', 'switch')).toBe(1);
    expect(countOf('accents', 'backspace')).toBe(1);
    expect(letterKeys('accents')).toHaveLength(17);
  });

  it('každé písmeno mřížky je platná přezdívka o jednom písmenu', () => {
    for (const letter of [...BASE_LETTERS, ...ACCENT_LETTERS]) {
      expect(isNickname(letter), letter).toBe(true);
    }
  });

  it('přepínač vymění vrstvu tam i zpět', () => {
    const { screens } = nicknameStep();

    screens.tapLayerSwitch();
    expect(screens.letterLayer()).toBe('accents');
    screens.tapLayerSwitch();
    expect(screens.letterLayer()).toBe('base');
  });

  it('po ťuknutí na písmeno s diakritikou se mřížka vrátí na základní vrstvu', () => {
    const { screens } = nicknameStep();
    screens.tapLayerSwitch();

    screens.tapLetter('Ř');

    expect(screens.nickname()).toBe('Ř');
    expect(screens.letterLayer()).toBe('base');
  });

  it('po písmenu ze základní vrstvy zůstane základní vrstva', () => {
    const { screens } = nicknameStep();

    screens.tapLetter('E');

    expect(screens.letterLayer()).toBe('base');
  });

  it('formulář vždy začíná na základní vrstvě, i když předchozí skončil na diakritice', () => {
    const { screens } = nicknameStep();
    screens.tapLayerSwitch();
    screens.tapBack();

    tapAdd(screens);

    expect(screens.letterLayer()).toBe('base');
  });
});

describe('#72 AC3: ťukání písmen', () => {
  it('ťuknutí na písmeno ho hned přidá na konec pole s odezvou', () => {
    const { screens, feedback } = nicknameStep();

    screens.tapLetter('E');
    screens.tapLetter('M');

    expect(screens.nickname()).toBe('EM');
    expect(feedback).toContainEqual({ kind: 'press', key: 'M' });
  });

  it('dvě rychlá ťuknutí na stejné písmeno přidají dvě písmena', () => {
    const { screens } = nicknameStep();

    screens.tapLetter('A');
    screens.tapLetter('A');

    expect(screens.nickname()).toBe('AA');
  });

  it('celá přezdívka s diakritikou jde naťukat („ČENĚK“)', () => {
    const { screens } = nicknameStep();

    typeNickname(screens, 'ČENĚK');

    expect(screens.nickname()).toBe('ČENĚK');
  });

  it('⌫ smaže poslední písmeno', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');

    screens.tapBackspace();

    expect(screens.nickname()).toBe('EM');
  });

  it('⌫ smaže i poslední písmeno s diakritikou celé', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'TŮ');

    screens.tapBackspace();

    expect(screens.nickname()).toBe('T');
  });

  it('⌫ funguje i na vrstvě diakritiky', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');
    screens.tapLayerSwitch();

    screens.tapBackspace();

    expect(screens.nickname()).toBe('EM');
  });

  it('⌫ na prázdném poli jen zhoupne', () => {
    const { screens, feedback } = nicknameStep();

    screens.tapBackspace();

    expect(screens.nickname()).toBe('');
    expect(feedback).toContainEqual({ kind: 'wobble', target: 'backspace' });
  });

  it('přezdívka má nejvýš 12 písmen', () => {
    expect(MAX_NICKNAME_LENGTH).toBe(12);
  });

  it('s 12 písmeny se další písmeno nepřidá a pole se jemně zatřese', () => {
    const { screens, feedback } = nicknameStep();
    typeNickname(screens, 'WWWWWWWWWWWW');

    screens.tapLetter('A');

    expect(screens.nickname()).toBe('WWWWWWWWWWWW');
    expect(feedback).toContainEqual(FIELD_SHAKE);
  });

  it('s 12 písmeny se nepřidá ani písmeno s diakritikou', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'ABCDEFGHIJKL');
    screens.tapLayerSwitch();

    screens.tapLetter('Ž');

    expect(screens.nickname()).toBe('ABCDEFGHIJKL');
  });
});

describe('#72 AC5: fyzická klávesnice v 1. kroku formuláře', () => {
  it('písmeno s diakritikou se přidá', () => {
    const { screens } = nicknameStep();

    screens.keyDown('Ř');

    expect(screens.nickname()).toBe('Ř');
  });

  it('malé písmeno se přidá velké, i s diakritikou („š“ dá „Š“)', () => {
    const { screens } = nicknameStep();

    for (const key of ['e', 'm', 'š', 'ů', 'ž']) {
      screens.keyDown(key);
    }

    expect(screens.nickname()).toBe('EMŠŮŽ');
  });

  it('jde napsat každé písmeno z mřížky, malé i velké', () => {
    for (const letter of [...ALPHABET, ...CZECH_ACCENTS]) {
      const { screens } = nicknameStep();

      screens.keyDown(letter.toLowerCase());
      screens.keyDown(letter);

      expect(screens.nickname(), letter).toBe(letter + letter);
    }
  });

  it('Backspace smaže poslední písmeno', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');

    screens.keyDown('Backspace');

    expect(screens.nickname()).toBe('EM');
  });

  it('číslice, mezera, interpunkce, emoji a Enter nic neudělají', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');

    for (const key of [
      '1',
      '0',
      ' ',
      '.',
      ',',
      '-',
      '!',
      '😀',
      'Enter',
      'Tab',
      'Shift',
      'Escape',
    ]) {
      screens.keyDown(key);
    }

    expect(screens.nickname()).toBe('EMA');
    expect(screens.screen()).toBe('nickname');
  });

  it('Enter neodešle přezdívku do 2. kroku', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');

    screens.keyDown('Enter');

    expect(screens.screen()).toBe('nickname');
  });

  it('písmena, která v mřížce nejsou (ä, ö, ß, ł), se nepřidají', () => {
    const { screens } = nicknameStep();

    for (const key of ['ä', 'Ö', 'ß', 'ł', 'ñ', 'щ']) {
      screens.keyDown(key);
    }

    expect(screens.nickname()).toBe('');
  });

  it('13. písmeno z klávesnice se nepřidá a pole se zatřese', () => {
    const { screens, feedback } = nicknameStep();
    for (let index = 0; index < 12; index += 1) {
      screens.keyDown('w');
    }

    screens.keyDown('a');

    expect(screens.nickname()).toBe('WWWWWWWWWWWW');
    expect(feedback).toContainEqual(FIELD_SHAKE);
  });

  it('na výběru profilu klávesnice nic neudělá', () => {
    const { screens, feedback, store } = testProfileScreens();

    for (const key of ['a', 'Backspace', 'Enter', ' ']) {
      screens.keyDown(key);
    }

    expect(screens.screen()).toBe('picker');
    expect(feedback).toEqual([]);
    expect(store.profiles()).toHaveLength(1);
  });

  it('ve 2. kroku (barva) klávesnice přezdívku nezmění', () => {
    const { screens } = nicknameStep();
    typeNickname(screens, 'EMA');
    screens.tapNext();

    for (const key of ['a', 'Backspace', 'Enter']) {
      screens.keyDown(key);
    }

    expect(screens.screen()).toBe('color');
    screens.tapBack();
    expect(screens.nickname()).toBe('EMA');
  });

  it('v menu a ve hře (obrazovka profilů zavřená) klávesnice nic neudělá', () => {
    const test = testProfileScreens();
    test.screens.tapProfile(test.store.activeProfile().id);
    const feedbackBefore = test.feedback.length;

    for (const key of ['a', 'Š', 'Backspace', 'Enter', ' ']) {
      test.screens.keyDown(key);
    }

    expect(test.screens.screen()).toBe('closed');
    expect(test.feedback).toHaveLength(feedbackBefore);
    expect(test.chosen()).toBe(1);
  });
});
