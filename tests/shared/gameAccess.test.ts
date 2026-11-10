import { afterEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import {
  GAME_ACCESS_LEVELS,
  isGameAccess,
  isGameUnlocked,
  subscriptionStateOf,
} from '../../src/shared/logic/gameAccess';
import type { GameAccess } from '../../src/shared/logic/gameAccess';
import {
  ALL_UNLOCKED_SOURCE,
  chooseSubscriptionSource,
} from '../../src/shared/logic/subscriptionSource';
import { watchedLocalStorage } from '../menu/menuFixtures';
import { ACTIVE_SOURCE, INACTIVE_SOURCE, NOT_ACTIVE_SOURCES } from './subscriptionFixtures';

/**
 * Testy k #74 (příprava na předplatné), AC2 a AC3. O odemčení rozhoduje
 * jediné místo ve sdílené logice (`src/shared/logic/gameAccess.ts`) podle
 * stavu ze zdroje, který jde vyměnit. Dnes je jen místní zdroj „vše
 * odemčeno“ (`src/shared/logic/subscriptionSource.ts`). Zkušební zdroje
 * (neaktivní, selhání, nesmysl, bez odpovědi) jsou jen v `tests/`.
 */

const FREE_GAME = { access: 'free' } as const;
const SUBSCRIPTION_GAME = { access: 'subscription' } as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('#74 AC2: hra zdarma jde hrát vždy, hra v předplatném jen při aktivním předplatném', () => {
  it('úrovně jsou právě dvě: zdarma a v předplatném', () => {
    expect([...GAME_ACCESS_LEVELS].sort()).toEqual(['free', 'subscription']);
  });

  it('při aktivním předplatném jsou odemčené hry zdarma i hry v předplatném', () => {
    expect(isGameUnlocked(FREE_GAME, ACTIVE_SOURCE)).toBe(true);
    expect(isGameUnlocked(SUBSCRIPTION_GAME, ACTIVE_SOURCE)).toBe(true);
  });

  describe.each(NOT_ACTIVE_SOURCES)('předplatné %s', (_name, source) => {
    it('hra zdarma je odemčená a nic nespadne', () => {
      expect(() => isGameUnlocked(FREE_GAME, source)).not.toThrow();
      expect(isGameUnlocked(FREE_GAME, source)).toBe(true);
    });

    it('hra v předplatném je zamčená a nic nespadne', () => {
      expect(() => isGameUnlocked(SUBSCRIPTION_GAME, source)).not.toThrow();
      expect(isGameUnlocked(SUBSCRIPTION_GAME, source)).toBe(false);
    });

    it('stav se bere jako neaktivní předplatné', () => {
      expect(subscriptionStateOf(source)).toBe('inactive');
    });
  });

  it('aktivní zdroj hlásí aktivní předplatné', () => {
    expect(subscriptionStateOf(ACTIVE_SOURCE)).toBe('active');
  });

  it('zdroj, který selže, nevypíše hráči žádnou chybu do konzole', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [, source] of NOT_ACTIVE_SOURCES) {
      isGameUnlocked(SUBSCRIPTION_GAME, source);
    }
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    errors.mockRestore();
    warnings.mockRestore();
  });

  it('hra s neznámou úrovní se při neaktivním předplatném neodemkne (bere se jako v předplatném)', () => {
    const strange = { access: 'zdarma' as unknown as GameAccess };
    expect(isGameUnlocked(strange, INACTIVE_SOURCE)).toBe(false);
    expect(isGameUnlocked(strange, ACTIVE_SOURCE)).toBe(true);
  });

  it.each([
    ['free', true],
    ['subscription', true],
    ['', false],
    ['FREE', false],
    ['zdarma', false],
    [undefined, false],
    [null, false],
    [1, false],
  ])('úroveň %j je platná: %s', (value, valid) => {
    expect(isGameAccess(value)).toBe(valid);
  });
});

describe('#74 AC3: dnes je vše odemčené a nejde to přepnout', () => {
  it('výběr zdroje vrací místní zdroj „vše odemčeno“', () => {
    expect(chooseSubscriptionSource()).toBe(ALL_UNLOCKED_SOURCE);
  });

  it.each([
    ['adresa s ?locked=1', 'https://hra.example/?locked=1&subscription=inactive#lock'],
    ['adresa s ?unlock=0', 'https://hra.example/?unlock=0&premium=false'],
    ['obyčejná adresa', 'https://hra.example/'],
  ])('výběr zdroje nezávisí na adrese stránky (%s)', (_name, href) => {
    vi.stubGlobal('location', new URL(href));
    expect(chooseSubscriptionSource()).toBe(ALL_UNLOCKED_SOURCE);
  });

  it('výběr zdroje nezávisí na úložišti', () => {
    watchedLocalStorage({
      subscription: 'inactive',
      'subscription.state': 'inactive',
      locked: 'true',
    });
    expect(chooseSubscriptionSource()).toBe(ALL_UNLOCKED_SOURCE);
  });

  it.each([
    ['vývoj', 'development', true],
    ['build', 'production', false],
  ])('výběr zdroje nezávisí na režimu (%s)', (_name, mode, dev) => {
    vi.stubEnv('MODE', mode);
    vi.stubEnv('DEV', dev);
    vi.stubEnv('PROD', !dev);
    expect(chooseSubscriptionSource()).toBe(ALL_UNLOCKED_SOURCE);
  });

  it('s místním zdrojem jsou odemčené všechny hry z registru', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    for (const game of GAMES) {
      expect(isGameUnlocked(game, chooseSubscriptionSource()), game.id).toBe(true);
    }
  });

  it('s místním zdrojem by byla odemčená i hra v předplatném', () => {
    expect(isGameUnlocked(SUBSCRIPTION_GAME, chooseSubscriptionSource())).toBe(true);
  });

  it('místní zdroj nic neukládá a nic neposílá', () => {
    const storage = watchedLocalStorage();
    const fetchSpy = vi.fn();
    const beacon = vi.fn();
    const socket = vi.fn();
    const request = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal('WebSocket', socket);
    vi.stubGlobal('XMLHttpRequest', request);
    vi.stubGlobal('sessionStorage', { setItem: vi.fn(), getItem: vi.fn() });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const source = chooseSubscriptionSource();
      source.currentState();
      isGameUnlocked(SUBSCRIPTION_GAME, source);
    }

    expect(storage.writes).toEqual([]);
    expect(storage.snapshot()).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('místní zdroj nejde přepnout na zamčeno ani zvenku (je zmrazený)', () => {
    expect(Object.isFrozen(ALL_UNLOCKED_SOURCE)).toBe(true);
    expect(ALL_UNLOCKED_SOURCE.currentState()).toBe('active');
  });
});
