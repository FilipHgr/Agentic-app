import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import type { GameHost, HomeHoldDecision } from '../../src/shared/logic/gameHost';
import { createHoldButton } from '../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS } from '../../src/shared/logic/homeButton';
import { startGameSession } from '../../src/shared/ui/gameSession';
import type { GameSession } from '../../src/shared/ui/gameSession';

/**
 * Testy k #124 AC4 ve sdílené části: hra může převzít podržení domečku.
 * Omalovánky s výběrem vedou domečkem v malování o úroveň výš (na výběr),
 * ne do menu. Podržení domečku hlídá stránka (`attachHomeButton`
 * s `createHoldButton`), po 1 s zavolá `session.holdHome()` místo dnešního
 * `session.leave()`. Hra, která se napojí háčkem `host.onHomeHold`, rozhodne:
 * `'stay'` zůstane ve hře, `'leave'` odejde do menu jako dnes. Bez háčku
 * (Počítání a každá další hra, která o háčku neví) se odchází do menu beze
 * změny. Ťuknutí na domeček ho dál jen zhoupne a háček se neptá.
 *
 * Navržené rozhraní:
 * - `src/shared/logic/gameHost.ts`: `type HomeHoldDecision = 'leave' | 'stay'`,
 *   `GameHost.onHomeHold?(decide: () => HomeHoldDecision): void`
 *   (volitelné, `isGameHost` přijme hostitele s ním i bez něj, nefunkci odmítne);
 *   nové napojení nahradí předchozí,
 * - `src/shared/ui/gameSession.ts`: `GameSession.holdHome(): void`
 *   (podržení domečku dokončené: bez háčku nebo s `'leave'` stejně jako
 *   `leave()`, s `'stay'` nic; po odchodu nic a háček se neptá),
 * - `src/shared/ui/gameRunner.ts`: `onGoHome: () => session.holdHome()`.
 */

interface TestSession {
  readonly session: GameSession;
  readonly homeButton: { hidden: boolean };
  readonly events: string[];
}

/** Hra spuštěná na stránce; `start` udělá to, co hra při startu (napojí se, ohlásí domeček). */
function startedGame(start: (host: GameHost) => void = () => undefined): TestSession {
  const homeButton = { hidden: true };
  const events: string[] = [];
  const session = startGameSession({
    homeButton,
    startScenes: (running) => {
      running.host.onLeave(() => events.push('hra zastavena'));
      running.host.setHomeAvailable(true);
      start(running.host);
      return () => events.push('úklid scén');
    },
    onLeft: () => events.push('odchod ohlášen'),
  });
  return { session, homeButton, events };
}

/** Hra jako Počítání: domeček ohlásí, na kolečko se napojí, o podržení domečku se nestará. */
function countingLikeGame(): TestSession {
  return startedGame((host) => {
    host.attachSettingsGear(() => undefined);
  });
}

/** Hra, která podržení domečku převezme a vždy odpoví `decisions` po řadě. */
function gameDeciding(...decisions: HomeHoldDecision[]): TestSession & { asked: () => number } {
  let asked = 0;
  const test = startedGame((host) => {
    host.onHomeHold?.(() => {
      const decision = decisions[asked] ?? 'stay';
      asked += 1;
      return decision;
    });
  });
  return { ...test, asked: () => asked };
}

const LEFT_IN_ORDER = ['hra zastavena', 'úklid scén', 'odchod ohlášen'];

describe('#124 AC4: bez háčku podržení domečku odchází do menu jako dnes', () => {
  it('stránka nabízí hře háček na podržení domečku', () => {
    const test = startedGame();
    expect(typeof test.session.host.onHomeHold).toBe('function');
  });

  it('hra bez háčku po podržení domečku odejde do menu ve stejném pořadí jako dnes', () => {
    const test = startedGame();
    test.session.holdHome();
    expect(test.events).toEqual(LEFT_IN_ORDER);
    expect(test.homeButton.hidden, 'domeček').toBe(true);
    expect(test.session.isHomeEnabled()).toBe(false);
  });

  it('Počítání (hra bez háčku) se nemění: podržení domečku vrací do menu', () => {
    const test = countingLikeGame();
    test.session.holdHome();
    expect(test.events).toEqual(LEFT_IN_ORDER);
  });

  it('druhé podržení po odchodu nic neudělá', () => {
    const test = startedGame();
    test.session.holdHome();
    test.session.holdHome();
    expect(test.events.filter((event) => event === 'odchod ohlášen')).toHaveLength(1);
  });
});

describe('#124 AC4: s háčkem o podržení domečku rozhoduje hra', () => {
  it('když hra odpoví „zůstat“, dítě zůstane ve hře a domeček jde použít dál', () => {
    const test = gameDeciding('stay');
    test.session.holdHome();
    expect(test.asked(), 'hra se zeptala jednou').toBe(1);
    expect(test.events, 'nic se nezastavilo ani neuklidilo').toEqual([]);
    expect(test.homeButton.hidden, 'domeček').toBe(false);
    expect(test.session.isHomeEnabled()).toBe(true);
  });

  it('když hra odpoví „odejít“, dítě odejde do menu ve stejném pořadí jako bez háčku', () => {
    const test = gameDeciding('leave');
    test.session.holdHome();
    expect(test.events).toEqual(LEFT_IN_ORDER);
  });

  it('hra rozhoduje při každém podržení znovu: po „zůstat“ může přijít „odejít“', () => {
    const test = gameDeciding('stay', 'leave');
    test.session.holdHome();
    expect(test.events, 'po prvním podržení').toEqual([]);
    test.session.holdHome();
    expect(test.events, 'po druhém podržení').toEqual(LEFT_IN_ORDER);
    expect(test.asked()).toBe(2);
  });

  it('po odchodu se hra na podržení domečku už neptá', () => {
    const test = gameDeciding('leave', 'leave');
    test.session.holdHome();
    test.session.holdHome();
    expect(test.asked()).toBe(1);
  });

  it('háček nemění odchod z jiných her: každá hra na stránce má svou session', () => {
    const coloring = gameDeciding('stay');
    const counting = countingLikeGame();
    coloring.session.holdHome();
    counting.session.holdHome();
    expect(coloring.events, 'hra s háčkem zůstala').toEqual([]);
    expect(counting.events, 'hra bez háčku odešla').toEqual(LEFT_IN_ORDER);
  });
});

describe('#124 AC4: domeček stránky s háčkem hry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Domeček stránky jako v `attachHomeButton`, jen bez DOM. */
  function pageHome(session: GameSession): {
    hold: () => void;
    tap: () => void;
    wobbles: () => number;
  } {
    let wobbles = 0;
    const button = createHoldButton({
      holdMs: HOLD_TO_GO_HOME_MS,
      isEnabled: () => session.isHomeEnabled(),
      onHoldComplete: () => session.holdHome(),
      onTap: () => {
        wobbles += 1;
      },
    });
    return {
      hold: () => {
        button.press(1);
        vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
        button.release(1);
      },
      tap: () => {
        button.press(1);
        vi.advanceTimersByTime(100);
        button.release(1);
      },
      wobbles: () => wobbles,
    };
  }

  it('ťuknutí na domeček ho jen zhoupne a hra se neptá', () => {
    const test = gameDeciding('leave');
    const home = pageHome(test.session);
    home.tap();
    expect(home.wobbles()).toBe(1);
    expect(test.asked()).toBe(0);
    expect(test.events).toEqual([]);
  });

  it('podržení 1 s se zeptá hry a „zůstat“ dítě nechá ve hře', () => {
    const test = gameDeciding('stay');
    pageHome(test.session).hold();
    expect(test.asked()).toBe(1);
    expect(test.events).toEqual([]);
  });

  it('podržení 1 s ve hře bez háčku odejde do menu', () => {
    const test = countingLikeGame();
    pageHome(test.session).hold();
    expect(test.events).toEqual(LEFT_IN_ORDER);
  });
});

describe('#124 AC4: stránka pro hru s háčkem i bez něj', () => {
  const base = {
    attachSettingsGear: () => () => undefined,
    setHomeAvailable: () => undefined,
    onLeave: () => undefined,
    storage: undefined,
  };

  it('hostitel bez háčku je dál platná stránka pro hru (starší hostitel, falešné stránky)', () => {
    expect(isGameHost(base)).toBe(true);
  });

  it('hostitel s háčkem je platná stránka pro hru', () => {
    expect(isGameHost({ ...base, onHomeHold: () => undefined })).toBe(true);
  });

  it('háček, který není funkce, stránku pro hru neudělá', () => {
    expect(isGameHost({ ...base, onHomeHold: 'stay' })).toBe(false);
  });
});
