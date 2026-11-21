import { describe, expect, it } from 'vitest';

import {
  MENU_GREETING_REPLAY_WAIT_MS,
  createMenuGreeting,
} from '../../src/menu/logic/menuGreeting';
import type {
  MenuGreeting,
  MenuGreetingFrame,
  MenuGreetingReplayStep,
} from '../../src/menu/logic/menuGreeting';
import { FingerMenu, MANY_GAMES, findWindow, manyLanguages } from './manyGamesFixtures';
import type { Point } from './manyGamesFixtures';

/**
 * Testy k #173: když první pozdrav Rudyho v menu proběhl bez hlasu, protože
 * Safari ještě nepustilo zvuk, Rudy ho zopakuje nahlas po prvním ťuknutí
 * mimo dlaždici hry (ťuknutí se provede normálně) nebo po zavření tichého
 * okna ťuknutím. Nejvýš jednou za načtení stránky, jen s hlasem, okno
 * nejdéle do 1,5 s od ťuknutí. Čas (ms) dává test.
 */

const SILENT_LOCKED = { withVoice: false, audioUnlocked: false };
const SILENT_UNLOCKED = { withVoice: false, audioUnlocked: true };
const VOICED = { withVoice: true, audioUnlocked: true };

const READY: MenuGreetingFrame = { audioUnlocked: true, covered: false };
const LOCKED: MenuGreetingFrame = { audioUnlocked: false, covered: false };
const COVERED: MenuGreetingFrame = { audioUnlocked: true, covered: true };

const NONE: MenuGreetingReplayStep = { kind: 'none' };
const WAIT: MenuGreetingReplayStep = { kind: 'wait' };
const GIVE_UP: MenuGreetingReplayStep = { kind: 'giveUp' };

/** Menu po prvním pozdravu, jehož okno se už zavřelo (samo, bez ťuknutí). */
function greetingAfterFirst(opened = SILENT_LOCKED): MenuGreeting {
  const greeting = createMenuGreeting();
  expect(greeting.menuShown('shown', 0)).toBe(true);
  greeting.greeted(500, opened);
  greeting.greetingClosed(4000);
  return greeting;
}

describe('#173 AC1: tichý první pozdrav zopakuje první ťuknutí mimo hru', () => {
  it('po ťuknutí mimo hru se pozdrav ukáže, jakmile je zvuk odemčený', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5016, READY)).toEqual({ kind: 'show', waitMs: 1484 });
  });

  it('dokud se zvuk neodemkne, pozdrav počká', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5016, LOCKED)).toEqual(WAIT);
    expect(greeting.replayStep(5100, READY).kind).toBe('show');
  });

  it('zopakovaný pozdrav se ukáže jen jednou, další snímky už nic', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    greeting.replayStep(5016, READY);
    expect(greeting.replayStep(5032, READY)).toEqual(NONE);
  });

  it('bez ťuknutí se pozdrav sám nezopakuje, ani s odemčeným zvukem', () => {
    const greeting = greetingAfterFirst();
    expect(greeting.replayStep(10_000, READY)).toEqual(NONE);
  });

  it('ťuknutí, dokud první pozdrav ještě nebyl, nic nezopakuje', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.tapped('other', 100);
    expect(greeting.replayStep(116, READY)).toEqual(NONE);
  });

  it('když byl zvuk odemčený a jen se nestáhla nahrávka, ťuknutí nic nezopakuje', () => {
    const greeting = greetingAfterFirst(SILENT_UNLOCKED);
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5016, READY)).toEqual(NONE);
  });

  it('dokud menu zakrývá panel, pozdrav se neukáže', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5016, COVERED)).toEqual(WAIT);
  });

  it('panel zavřený do limitu pozdrav pustí, panel otevřený po celý limit ho vynechá', () => {
    const closedSoon = greetingAfterFirst();
    closedSoon.tapped('other', 5000);
    closedSoon.replayStep(5016, COVERED);
    expect(closedSoon.replayStep(5800, READY).kind, 'zavřený panel').toBe('show');

    const staysOpen = greetingAfterFirst();
    staysOpen.tapped('other', 5000);
    staysOpen.replayStep(5016, COVERED);
    expect(staysOpen.replayStep(5000 + MENU_GREETING_REPLAY_WAIT_MS, READY), 'otevřený').toEqual(
      GIVE_UP,
    );
  });
});

describe('#173: ťuknutí do tichého okna zopakuje pozdrav hned po jeho zavření', () => {
  it('ťuknutí, které tiché okno zavře, pustí pozdrav s hlasem', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(500, SILENT_LOCKED);
    greeting.tapped('greetingWindow', 2000);
    greeting.greetingClosed(2000);
    expect(greeting.replayStep(2016, READY).kind).toBe('show');
  });

  it('limit 1,5 s se počítá od zavření okna', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(500, SILENT_LOCKED);
    // Ťuknutí v první 1 s okno nezavře; zavře se samo později.
    greeting.tapped('greetingWindow', 900);
    greeting.greetingClosed(4000);
    expect(greeting.replayStep(5400, READY)).toEqual({ kind: 'show', waitMs: 100 });
  });

  it('po zopakování další ťuknutí do menu už nic neopakuje', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(500, SILENT_LOCKED);
    greeting.tapped('greetingWindow', 2000);
    greeting.greetingClosed(2000);
    greeting.replayStep(2016, READY);
    greeting.greeted(2300, VOICED);
    greeting.greetingClosed(5000);
    greeting.tapped('other', 6000);
    expect(greeting.replayStep(6016, READY)).toEqual(NONE);
  });

  it('okno, které se zavřelo samo bez ťuknutí, pozdrav nezopakuje', () => {
    const greeting = greetingAfterFirst();
    expect(greeting.replayStep(4016, READY)).toEqual(NONE);
  });
});

describe('#173: nahrávka se stahuje hned po odemčení zvuku', () => {
  it('po tichém pozdravu se nahrávka začne stahovat, jakmile je zvuk odemčený, jen jednou', () => {
    const greeting = greetingAfterFirst();
    expect(greeting.shouldPrepareVoice(false), 'zamčený zvuk').toBe(false);
    expect(greeting.shouldPrepareVoice(true), 'odemčený zvuk').toBe(true);
    expect(greeting.shouldPrepareVoice(true), 'podruhé').toBe(false);
  });

  it('po pozdravu s hlasem se nic dopředu nestahuje', () => {
    const greeting = greetingAfterFirst(VOICED);
    expect(greeting.shouldPrepareVoice(true)).toBe(false);
  });
});

describe('#173 AC2: ťuknutí na dlaždici hru spustí a pozdrav se neopakuje', () => {
  it('po ťuknutí na dlaždici se pozdrav nezopakuje, ani po návratu do menu', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('game', 5000);
    expect(greeting.replayStep(5016, READY)).toEqual(NONE);
    greeting.menuShown('returnedFromGame', 60_000);
    greeting.tapped('other', 70_000);
    expect(greeting.replayStep(70_016, READY)).toEqual(NONE);
  });
});

describe('#173 AC3: nejvýš jednou za načtení stránky, po pozdravu s hlasem vůbec', () => {
  it('po prvním pozdravu s hlasem ťuknutí nic nezopakuje', () => {
    const greeting = greetingAfterFirst(VOICED);
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5016, READY)).toEqual(NONE);
  });

  it('po zopakování (i znovu tichém) další ťuknutí nic nezopakuje', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    greeting.replayStep(5016, READY);
    greeting.greeted(5500, SILENT_LOCKED);
    greeting.greetingClosed(9000);
    greeting.tapped('other', 9500);
    expect(greeting.replayStep(9516, READY)).toEqual(NONE);
  });

  it('pozdrav po návratu ze hry zopakování nenabídne, i když byl tichý', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    // První pozdrav se nestáhl, Rudy poprvé pozdraví až po návratu ze hry.
    expect(greeting.menuShown('returnedFromGame', 60_000)).toBe(true);
    greeting.greeted(60_500, SILENT_LOCKED);
    greeting.greetingClosed(64_000);
    greeting.tapped('other', 70_000);
    expect(greeting.replayStep(70_016, READY)).toEqual(NONE);
  });

  it('zopakovaný pozdrav se počítá do 10 minut mezi pozdravy', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    greeting.replayStep(5016, READY);
    greeting.greeted(5500, VOICED);
    expect(greeting.menuShown('returnedFromGame', 5500 + 9 * 60_000)).toBe(false);
  });
});

describe('#173 AC4: bez hlasu se pozdrav podruhé neukáže', () => {
  it('když se zvuk do 1,5 s od ťuknutí neodemkne, pozdrav se vynechá', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(5000 + MENU_GREETING_REPLAY_WAIT_MS, LOCKED)).toEqual(GIVE_UP);
    expect(greeting.replayStep(5000 + MENU_GREETING_REPLAY_WAIT_MS + 16, READY)).toEqual(NONE);
  });

  it('vynechaný pozdrav už další ťuknutí nezopakuje', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    greeting.replayStep(5000 + MENU_GREETING_REPLAY_WAIT_MS, LOCKED);
    greeting.tapped('other', 9000);
    expect(greeting.replayStep(9016, READY)).toEqual(NONE);
  });

  it('okno dostane jen zbytek limitu na stažení', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    greeting.replayStep(5200, LOCKED);
    expect(greeting.replayStep(5400, READY)).toEqual({
      kind: 'show',
      waitMs: MENU_GREETING_REPLAY_WAIT_MS - 400,
    });
  });

  it('nesmyslný čas zopakování neukáže', () => {
    const greeting = greetingAfterFirst();
    greeting.tapped('other', 5000);
    expect(greeting.replayStep(Number.NaN, READY)).toEqual(GIVE_UP);
    expect(greeting.replayStep(5100, READY)).toEqual(NONE);
  });
});

const IPAD = findWindow('iPad 1180×820');
const PHONE_PORTRAIT = findWindow('390×844');

/** Menu na prstech s pozdravem napojeným jako na stránce, po tichém prvním pozdravu. */
function fingerMenuAfterSilentGreeting(window = IPAD): {
  finger: FingerMenu;
  replayShown: () => boolean;
} {
  const greeting = greetingAfterFirst();
  const finger = new FingerMenu(window, MANY_GAMES, manyLanguages(), (kind, nowMs) =>
    greeting.tapped(kind, nowMs),
  );
  finger.now = 5000;
  return {
    finger,
    replayShown: () => {
      const covered = finger.menu.isLanguageMenuOpen() || finger.menu.isCategoryMenuOpen();
      return greeting.replayStep(finger.now, { audioUnlocked: true, covered }).kind === 'show';
    },
  };
}

function selectedCategory(finger: FingerMenu): string | undefined {
  return finger.menu.categories().find((category) => category.selected)?.id;
}

describe('#173 na prstech: ťuknutí se provede normálně a zopakuje pozdrav', () => {
  it('ťuknutí na kategorii ji vybere a pozdrav zopakuje', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    const before = selectedCategory(finger);
    finger.tap(finger.categoryCenter(1));
    expect(selectedCategory(finger), 'vybraná kategorie').not.toBe(before);
    expect(replayShown(), 'zopakování').toBe(true);
  });

  it('ťuknutí na kolečko profilu výběr otevře a pozdrav zopakuje', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    const badge = finger.layout().profileBadge.circle;
    finger.tap({ x: (badge.left + badge.right) / 2, y: (badge.top + badge.bottom) / 2 });
    expect(finger.profileOpened, 'výběr profilu').toBe(1);
    expect(replayShown(), 'zopakování').toBe(true);
  });

  it('ťuknutí do prázdného místa pozdrav zopakuje', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    const layout = finger.layout();
    const empty: Point = { x: layout.languageSlot.left - 4, y: layout.languageSlot.top + 4 };
    finger.tap(empty);
    expect(replayShown()).toBe(true);
  });

  it('ťuknutí, které otevře nabídku jazyků, ji otevře a pozdrav přes ni neukáže', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    finger.tap(finger.languageButtonCenter());
    expect(finger.menu.isLanguageMenuOpen(), 'nabídka jazyků').toBe(true);
    expect(replayShown(), 'zopakování').toBe(false);
  });

  it('ťuknutí, které otevře seznam kategorií, pozdrav přes něj neukáže', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting(PHONE_PORTRAIT);
    finger.tap(finger.categoryButtonCenter());
    expect(finger.menu.isCategoryMenuOpen(), 'seznam kategorií').toBe(true);
    expect(replayShown(), 'zopakování').toBe(false);
  });

  it('tah po mřížce pozdrav nezopakuje a mřížku posune', () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    const center = finger.gridCenter();
    finger.slowDrag(center, { x: center.x, y: center.y - 200 });
    expect(finger.touch.gridOffset(), 'posun mřížky').toBeGreaterThan(0);
    expect(replayShown(), 'zopakování').toBe(false);
  });

  it('ťuknutí na dlaždici hru spustí a pozdrav nezopakuje', async () => {
    const { finger, replayShown } = fingerMenuAfterSilentGreeting();
    finger.tap(finger.tileCenter(0));
    // Hra se stahuje: spustí se až po vyřízení stažení.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finger.started, 'spuštěná hra').toEqual([MANY_GAMES[0]?.id]);
    expect(replayShown(), 'zopakování').toBe(false);
  });
});
