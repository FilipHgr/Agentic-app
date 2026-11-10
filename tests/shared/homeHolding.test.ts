import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import type { GameHost } from '../../src/shared/logic/gameHost';
import { createHoldButton } from '../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS } from '../../src/shared/logic/homeButton';
import { startGameSession } from '../../src/shared/ui/gameSession';
import type { GameSession } from '../../src/shared/ui/gameSession';

/**
 * Testy k #129 AC5 ve sdílené části: hra se dozví, kdy dítě drží domeček.
 * Omalovánky podle toho nepustí koš na velkém obrázku, dokud se domeček
 * drží. Stránka hlásí plnění kroužku domečku (`attachHomeButton`
 * s `createHoldButton`, `onHoldingChange`) do `session.homeHoldingChanged`
 * a ta ho předá hře napojené háčkem `host.onHomeHolding`. Hra bez háčku
 * (Počítání) se nemění.
 */

interface HoldingTest {
  readonly session: GameSession;
  readonly heard: boolean[];
  readonly events: string[];
}

/** Hra na stránce; `start` udělá to, co hra při startu. */
function startedGame(start: (host: GameHost, heard: boolean[]) => void): HoldingTest {
  const heard: boolean[] = [];
  const events: string[] = [];
  const session = startGameSession({
    homeButton: { hidden: true },
    startScenes: (running) => {
      running.host.setHomeAvailable(true);
      start(running.host, heard);
      return () => events.push('úklid scén');
    },
    onLeft: () => events.push('odchod ohlášen'),
  });
  return { session, heard, events };
}

/** Hra, která poslouchá držení domečku. */
function listeningGame(): HoldingTest {
  return startedGame((host, heard) => {
    host.onHomeHolding?.((holding) => heard.push(holding));
    host.onHomeHold?.(() => 'stay');
  });
}

/** Domeček stránky jako v `attachHomeButton`, jen bez DOM. */
function pageHome(session: GameSession) {
  return createHoldButton({
    holdMs: HOLD_TO_GO_HOME_MS,
    isEnabled: () => session.isHomeEnabled(),
    onHoldComplete: () => session.holdHome(),
    onTap: () => undefined,
    onHoldingChange: (holding) => session.homeHoldingChanged(holding),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#129 AC5: hra se dozví, kdy se drží domeček', () => {
  it('stránka nabízí hře háček na držení domečku', () => {
    const test = listeningGame();
    expect(typeof test.session.host.onHomeHolding).toBe('function');
  });

  it('když dítě domeček drží, hra to ví, a když ho pustí dřív než za 1 s, dozví se to taky', () => {
    const test = listeningGame();
    const home = pageHome(test.session);

    home.press(1);
    expect(test.heard, 'držení začalo').toEqual([true]);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS / 2);
    home.release(1);

    expect(test.heard, 'držení skončilo').toEqual([true, false]);
  });

  it('když prst z domečku sjede, hra se dozví, že se domeček už nedrží', () => {
    const test = listeningGame();
    const home = pageHome(test.session);

    home.press(1);
    home.leave(1);

    expect(test.heard).toEqual([true, false]);
  });

  it('po dokončeném podržení hra ví, že se domeček už nedrží', () => {
    const test = listeningGame();
    const home = pageHome(test.session);

    home.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    home.release(1);

    expect(test.heard).toEqual([true, false]);
  });

  it('nové napojení nahradí předchozí', () => {
    const first: boolean[] = [];
    const second: boolean[] = [];
    const test = startedGame((host) => {
      host.onHomeHolding?.((holding) => first.push(holding));
      host.onHomeHolding?.((holding) => second.push(holding));
    });

    test.session.homeHoldingChanged(true);

    expect(first).toEqual([]);
    expect(second).toEqual([true]);
  });

  it('po odchodu z hry se hra o držení domečku už nedozví', () => {
    const test = listeningGame();
    test.session.leave();

    test.session.homeHoldingChanged(true);

    expect(test.heard).toEqual([]);
  });

  it('hra bez háčku (Počítání) se nemění: držení i podržení domečku funguje jako dřív', () => {
    const test = startedGame((host) => {
      host.attachSettingsGear(() => undefined);
    });
    const home = pageHome(test.session);

    home.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    home.release(1);

    expect(test.events).toEqual(['úklid scén', 'odchod ohlášen']);
  });
});

describe('#129 AC5: stránka pro hru s háčkem na držení domečku i bez něj', () => {
  const base = {
    attachSettingsGear: () => () => undefined,
    setHomeAvailable: () => undefined,
    onLeave: () => undefined,
    storage: undefined,
  };

  it('hostitel bez háčku i s ním je platná stránka pro hru', () => {
    expect(isGameHost(base), 'bez háčku').toBe(true);
    expect(isGameHost({ ...base, onHomeHolding: () => undefined }), 's háčkem').toBe(true);
  });

  it('háček, který není funkce, stránku pro hru neudělá', () => {
    expect(isGameHost({ ...base, onHomeHolding: true })).toBe(false);
  });
});
