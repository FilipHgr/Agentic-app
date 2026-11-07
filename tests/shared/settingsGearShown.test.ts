import { describe, expect, it } from 'vitest';

import { startGameSession } from '../../src/shared/ui/gameSession';
import type { GameSession } from '../../src/shared/ui/gameSession';

/**
 * Testy k #88 AC6 (sdílená část): „V Omalovánkách kolečko nastavení není
 * vidět, v Počítání ano.“ Doporučení k otázce 2: kolečko se ukáže jen ve
 * hře, která má nastavení. Hra s nastavením se na kolečko napojí
 * (`GameHost.attachSettingsGear`, Počítání to dělá při startu), hra bez
 * nastavení (Omalovánky) ne. Kolečko je falešné tlačítko s atributem `hidden`.
 *
 * Navržené rozhraní: `startGameSession` dostane navíc
 * `settingsButton?: { hidden: boolean } | null` a kolečko ukazuje, jen
 * dokud je na něj napojená běžící hra. Menu pak kolečko jen skrývá
 * (jako domeček), ukáže ho běžící hra.
 */

interface TestSession {
  readonly session: GameSession;
  readonly settingsButton: { hidden: boolean };
}

/** Hra spuštěná na stránce; `attachGear` určuje, jestli se při startu napojí na kolečko. */
function startedGame(attachGear: boolean): TestSession {
  // Kolečko začíná viditelné, aby test poznal, že ho stránka sama skryje.
  const settingsButton = { hidden: false };
  const session = startGameSession({
    homeButton: { hidden: true },
    settingsButton,
    startScenes: (running) => {
      if (attachGear) {
        running.host.attachSettingsGear(() => undefined);
      }
      return () => undefined;
    },
    onLeft: () => undefined,
  });
  return { session, settingsButton };
}

describe('#88 AC6: kolečko nastavení je vidět jen ve hře, která má nastavení', () => {
  it('ve hře bez nastavení (Omalovánky) kolečko není vidět', () => {
    expect(startedGame(false).settingsButton.hidden).toBe(true);
  });

  it('ve hře s nastavením (Počítání) je kolečko vidět', () => {
    expect(startedGame(true).settingsButton.hidden).toBe(false);
  });

  it('když se hra od kolečka odpojí, kolečko zmizí', () => {
    const test = startedGame(false);
    const detach = test.session.host.attachSettingsGear(() => undefined);
    expect(test.settingsButton.hidden, 'napojená hra').toBe(false);
    detach();
    expect(test.settingsButton.hidden, 'po odpojení').toBe(true);
  });

  it('po odchodu domečkem z hry s nastavením kolečko zmizí', () => {
    const test = startedGame(true);
    test.session.leave();
    expect(test.settingsButton.hidden).toBe(true);
  });

  it('podržení kolečka ve hře bez nastavení nic neotevře ani neshodí', () => {
    const test = startedGame(false);
    expect(() => test.session.openSettings()).not.toThrow();
  });

  it('stránka bez kolečka (null) hru spustí a nic nespadne', () => {
    expect(() =>
      startGameSession({
        homeButton: null,
        settingsButton: null,
        startScenes: (running) => {
          running.host.attachSettingsGear(() => undefined);
          return () => undefined;
        },
        onLeft: () => undefined,
      }),
    ).not.toThrow();
  });
});
