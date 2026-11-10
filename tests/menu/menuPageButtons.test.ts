import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import { createPageMenu } from '../../src/menu/ui/pageMenu';
import type { CornerButtons } from '../../src/menu/ui/pageMenu';
import type { SubscriptionSource } from '../../src/shared/logic/gameAccess';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import { chooseSubscriptionSource } from '../../src/shared/logic/subscriptionSource';
import { runGame } from '../../src/shared/ui/gameRunner';
import type { RunGameOptions } from '../../src/shared/ui/gameRunner';
import { ACTIVE_SOURCE, NOT_ACTIVE_SOURCES } from '../shared/subscriptionFixtures';
import { FakeDownload, TEST_CATEGORIES, TEST_TEXTS_CS, translatorOf } from './menuFixtures';

/**
 * Testy k #83 AC1, AC2, AC3 (část menu) a AC4: stránka menu napojená na
 * spouštění her tak, jak ji skládá `src/menu/ui/menuPage.ts`
 * (`createPageMenu`). Skutečné jsou logika menu, výběr zdroje předplatného
 * (`chooseSubscriptionSource`) i `launchGame`. Nahrazená je jen Phaser hra
 * (`runGame`), kterou v node nejde pustit, a u AC1 to, co výběr zdroje
 * vrátí. Kolečko a domeček jsou falešná tlačítka s atributem `hidden`.
 *
 * Navržené rozhraní (`src/menu/ui/pageMenu.ts`):
 * - `CornerButtons { settingsButton, homeButton }`, každé `{ hidden: boolean } | null`,
 * - `createPageMenu(options)` vytvoří menu stránky; `options` jsou
 *   `MenuOptions` bez `start`, `onStarted` a `onReturned` a navíc
 *   `buttons`, `closeMenu`, `reopenMenu`, volitelně `gameStorage`
 *   a `onPageStateChanged`. Hru spouští přes `launchGame` se zdrojem
 *   z `chooseSubscriptionSource()`, tlačítka nastaví hned po vytvoření,
 *   po naběhnutí hry, po návratu a po změně jazyka.
 */

vi.mock('../../src/shared/ui/gameRunner', () => ({
  isGameModule: (value: unknown) =>
    typeof value === 'object' && value !== null && 'scenes' in value,
  runGame: vi.fn(),
}));

vi.mock('../../src/shared/logic/subscriptionSource', () => ({
  chooseSubscriptionSource: vi.fn(() => ({ currentState: () => 'active' })),
}));

const LOADED_GAME = { scenes: ['ZkusebniScena'] };

function testGame(id: string, access: GameEntry['access'], load: GameEntry['load']): GameEntry {
  return { id, titleKey: `games.${id}.title`, categoryId: 'adding', symbol: '1+1', access, load };
}

/** Falešné tlačítko stránky: menu u něj přepíná jen `hidden`. */
interface FakeButton {
  hidden: boolean;
}

interface TestPage {
  readonly menu: Menu;
  readonly settingsButton: FakeButton;
  readonly homeButton: FakeButton;
  readonly feedback: MenuFeedback[];
  readonly closedMenu: string[];
  readonly reopened: number[];
}

/**
 * Stránka menu s hrou zdarma `zebra` a hrou v předplatném `placena`.
 * Tlačítka začínají viditelná, aby test poznal, že je menu samo skryje.
 */
function testPage(load: GameEntry['load'] = () => Promise.resolve(LOADED_GAME)): TestPage {
  const settingsButton: FakeButton = { hidden: false };
  const homeButton: FakeButton = { hidden: false };
  const buttons: CornerButtons = { settingsButton, homeButton };
  const feedback: MenuFeedback[] = [];
  const closedMenu: string[] = [];
  const reopened: number[] = [];
  const menu = createPageMenu({
    games: [testGame('zebra', 'free', load), testGame('placena', 'subscription', load)],
    categories: TEST_CATEGORIES,
    translate: translatorOf({
      ...TEST_TEXTS_CS,
      'page.title': 'Matematika',
      'games.placena.title': 'Placená',
    }),
    feedback: (event) => feedback.push(event),
    buttons,
    closeMenu: () => closedMenu.push('menu'),
    reopenMenu: () => reopened.push(reopened.length),
  });
  return { menu, settingsButton, homeButton, feedback, closedMenu, reopened };
}

/** Ťukne na dlaždici a nechá doběhnout stažení i spuštění. */
async function tapTile(page: TestPage, gameId: string): Promise<void> {
  page.menu.tapTile(gameId);
  await vi.advanceTimersByTimeAsync(0);
}

/** Jak runGame dostal odchod z hry: domeček v běžící hře zavolá `onLeft`. */
function lastRunOptions(): RunGameOptions {
  const call = vi.mocked(runGame).mock.calls.at(-1);
  if (call === undefined) {
    throw new Error('hra se nespustila');
  }
  return call[1];
}

function useSource(source: SubscriptionSource): void {
  vi.mocked(chooseSubscriptionSource).mockReturnValue(source);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(runGame).mockReset();
  useSource(ACTIVE_SOURCE);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#83 AC1: zamčená hra nejde na stránce menu spustit', () => {
  it('při aktivním předplatném z výběru zdroje se hra v předplatném ťuknutím spustí', async () => {
    const page = testPage();
    await tapTile(page, 'placena');
    expect(runGame).toHaveBeenCalledTimes(1);
    expect(page.menu.runningGame()?.id).toBe('placena');
    expect(page.closedMenu).toEqual(['menu']);
  });

  it('když výběr zdroje vrátí neaktivní předplatné, ťuknutí hru nespustí a dlaždice se zatřese', async () => {
    for (const [name, source] of NOT_ACTIVE_SOURCES) {
      vi.mocked(runGame).mockClear();
      useSource(source);
      const page = testPage();
      await tapTile(page, 'placena');
      expect(vi.mocked(runGame).mock.calls.length, `${name}: hra se nespustila`).toBe(0);
      expect(page.menu.runningGame(), `${name}: dítě zůstalo v menu`).toBeNull();
      expect(page.closedMenu, `${name}: menu se nezavřelo`).toEqual([]);
      expect(page.feedback, `${name}: dlaždice se zatřásla`).toContainEqual({
        kind: 'shake',
        gameId: 'placena',
      });
      expect(page.settingsButton.hidden, `${name}: kolečko zůstalo skryté`).toBe(true);
    }
  });
});

/**
 * #83 AC2 upřesnilo #88 AC6: kolečko je vidět jen v běžící hře, která se
 * na něj napojí (Počítání ano, Omalovánky ne). Napojení a ukázání kolečka
 * dělá stránka hry (`startGameSession`, `tests/shared/settingsGearShown.test.ts`),
 * menu kolečko jen skrývá. Tady se ověří, že menu kolečko samo neukáže, napojené
 * hře ho při naběhnutí neschová a po návratu ho vždy schová. Napojení hry
 * napodobí falešná Phaser hra: ukáže kolečko jako skutečná stránka hry.
 */
describe('#83 AC2, #88 AC6: kolečko nastavení je vidět jen v běžící hře, která se na něj napojí', () => {
  /** Falešná hra se při spuštění napojí na kolečko, jako to dělá Počítání. */
  function gameAttachesGear(page: TestPage): void {
    vi.mocked(runGame).mockImplementation(() => {
      page.settingsButton.hidden = false;
      // Phaser hra v node nevzniká, menu ji nepoužívá.
      return undefined as never;
    });
  }

  it('kolečko je v menu skryté, u hry napojené na kolečko po naběhnutí vidět a po návratu do menu zase skryté', async () => {
    const page = testPage();
    gameAttachesGear(page);
    expect(page.settingsButton.hidden, 'v menu').toBe(true);

    await tapTile(page, 'zebra');
    expect(page.menu.runningGame()?.id, 'hra naběhla').toBe('zebra');
    expect(page.settingsButton.hidden, 'po naběhnutí hry napojené na kolečko').toBe(false);

    lastRunOptions().onLeft();
    expect(page.menu.runningGame(), 'dítě je zpátky v menu').toBeNull();
    expect(page.settingsButton.hidden, 'po návratu do menu').toBe(true);
    expect(page.reopened, 'menu se znovu ukázalo').toHaveLength(1);
  });

  it('u hry, která se na kolečko nenapojí, menu kolečko samo neukáže ani po naběhnutí hry', async () => {
    const page = testPage();
    await tapTile(page, 'zebra');
    expect(page.menu.runningGame()?.id, 'hra naběhla').toBe('zebra');
    expect(page.settingsButton.hidden, 'po naběhnutí hry bez kolečka').toBe(true);

    lastRunOptions().onLeft();
    expect(page.settingsButton.hidden, 'po návratu do menu').toBe(true);
  });

  it('kolečko se u napojené hry ukáže i při každém dalším vstupu do hry a po každém návratu se skryje', async () => {
    const page = testPage();
    gameAttachesGear(page);
    for (let round = 1; round <= 3; round += 1) {
      await tapTile(page, 'zebra');
      expect(page.settingsButton.hidden, `${round}. vstup do hry`).toBe(false);
      lastRunOptions().onLeft();
      expect(page.settingsButton.hidden, `${round}. návrat do menu`).toBe(true);
    }
  });
});

describe('#83 AC3: domeček menu neukazuje, jen skrývá', () => {
  it('domeček je v menu skrytý a samotné naběhnutí hry ho neukáže', async () => {
    const page = testPage();
    expect(page.homeButton.hidden, 'v menu').toBe(true);

    await tapTile(page, 'zebra');
    expect(page.menu.runningGame()?.id, 'hra naběhla').toBe('zebra');
    expect(page.homeButton.hidden, 'po naběhnutí hry, než hra ohlásí domeček').toBe(true);
  });

  it('po odchodu z hry je domeček zase skrytý, i když ho hra předtím ukázala', async () => {
    const page = testPage();
    await tapTile(page, 'zebra');
    // Hra ohlásila, že domeček jde použít (to dělá stránka hry, ne menu).
    page.homeButton.hidden = false;

    lastRunOptions().onLeft();
    expect(page.homeButton.hidden).toBe(true);
  });
});

describe('#83 AC4: kolečko i domeček zůstanou skryté, když hra nenaběhne', () => {
  it('během stahování, po nestažené hře i po selhání při spuštění jsou kolečko i domeček skryté', async () => {
    const cases: ReadonlyArray<
      readonly [string, (page: TestPage, download: FakeDownload) => void]
    > = [
      ['během stahování', () => undefined],
      ['když se hra nestáhne', (_page, download) => download.fail()],
      [
        'když hra při spuštění selže',
        (_page, download) => {
          vi.mocked(runGame).mockImplementation(() => {
            throw new Error('hra při spuštění spadla');
          });
          download.succeed(LOADED_GAME);
        },
      ],
      ['když stažený soubor není hra', (_page, download) => download.succeed({ bezScen: true })],
    ];
    for (const [name, finish] of cases) {
      vi.mocked(runGame).mockReset();
      const download = new FakeDownload();
      const page = testPage(download.load);
      page.menu.tapTile('zebra');
      await vi.advanceTimersByTimeAsync(0);
      finish(page, download);
      await vi.advanceTimersByTimeAsync(0);
      expect(page.menu.runningGame(), `${name}: hra neběží`).toBeNull();
      expect(page.settingsButton.hidden, `${name}: kolečko`).toBe(true);
      expect(page.homeButton.hidden, `${name}: domeček`).toBe(true);
    }
  });
});
