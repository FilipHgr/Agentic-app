import { describe, expect, it } from 'vitest';

import type { GameHost } from '../../src/shared/logic/gameHost';
import { startGameSession } from '../../src/shared/ui/gameSession';
import type { GameSession } from '../../src/shared/ui/gameSession';

/**
 * Testy k #83 AC3 (část hry na stránce): domeček (`#home-button`) ukazuje
 * a skrývá běžící hra přes `GameHost.setHomeAvailable` (#68 AC4). Logika
 * domečku je vyčleněná z `runGame` do `startGameSession`, která dostane
 * tlačítko a spuštění scén zvenku, takže jde pustit v node bez DOM
 * a bez Phaseru. Domeček je falešné tlačítko s atributem `hidden`.
 *
 * Navržené rozhraní (`src/shared/ui/gameSession.ts`, bez Phaseru):
 * - `startGameSession({ homeButton, storage?, startScenes, onLeft })`
 *   vrátí `GameSession`,
 * - `homeButton: { hidden: boolean } | null`,
 * - `startScenes(session)` spustí scény hry s `session.host` a vrátí úklid
 *   (odpojení tlačítek a hlídání okna, zničení hry), který se zavolá při
 *   odchodu,
 * - `GameSession { host: GameHost; isHomeEnabled(): boolean;
 *   openSettings(): void; leave(): void }`.
 */

interface TestSession {
  readonly session: GameSession;
  readonly homeButton: { hidden: boolean };
  /** Co se stalo, v pořadí: zastavení hry, úklid scén, ohlášení odchodu. */
  readonly events: string[];
}

/** Hra spuštěná na stránce; domeček je při startu skrytý jako v menu. */
function startedGame(): TestSession {
  const homeButton = { hidden: true };
  const events: string[] = [];
  const started: { host: GameHost | null } = { host: null };
  const session = startGameSession({
    homeButton,
    startScenes: (running) => {
      started.host = running.host;
      events.push('scény spuštěné');
      return () => events.push('úklid scén');
    },
    onLeft: () => events.push('odchod ohlášen'),
  });
  if (started.host !== session.host) {
    throw new Error('scény nedostaly hostitele hry');
  }
  return { session, homeButton, events };
}

describe('#83 AC3: domeček je vidět, jen když ho hra ohlásí', () => {
  it('po spuštění hry zůstane domeček skrytý, dokud hra neohlásí, že jde použít (první spuštění s nastavením)', () => {
    const test = startedGame();
    expect(test.events, 'scény se spustily').toEqual(['scény spuštěné']);
    expect(test.homeButton.hidden, 'domeček').toBe(true);
    expect(test.session.isHomeEnabled(), 'domeček nejde použít').toBe(false);
  });

  it('když hra ohlásí, že domeček jde použít, ukáže se', () => {
    const test = startedGame();
    test.session.host.setHomeAvailable(true);
    expect(test.homeButton.hidden).toBe(false);
    expect(test.session.isHomeEnabled()).toBe(true);
  });

  it('když hra ohlásí, že domeček nejde použít, skryje se', () => {
    const test = startedGame();
    test.session.host.setHomeAvailable(true);
    test.session.host.setHomeAvailable(false);
    expect(test.homeButton.hidden).toBe(true);
    expect(test.session.isHomeEnabled()).toBe(false);
  });

  it('po odchodu z hry je domeček skrytý a hra je uklizená', () => {
    const test = startedGame();
    test.session.host.onLeave(() => test.events.push('hra zastavena'));
    test.session.host.setHomeAvailable(true);

    test.session.leave();
    expect(test.homeButton.hidden, 'domeček').toBe(true);
    expect(test.session.isHomeEnabled(), 'domeček nejde použít').toBe(false);
    expect(test.events, 'pořadí odchodu').toEqual([
      'scény spuštěné',
      'hra zastavena',
      'úklid scén',
      'odchod ohlášen',
    ]);
  });

  it('když hra ohlásí domeček až po odchodu, domeček zůstane skrytý', () => {
    const test = startedGame();
    test.session.leave();
    test.session.host.setHomeAvailable(true);
    expect(test.homeButton.hidden).toBe(true);
    expect(test.session.isHomeEnabled()).toBe(false);
  });

  it('druhý odchod nic neudělá', () => {
    const test = startedGame();
    test.session.leave();
    test.session.leave();
    expect(test.events.filter((event) => event === 'odchod ohlášen')).toHaveLength(1);
  });
});
