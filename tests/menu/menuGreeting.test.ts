import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MENU_GREETING_PAUSE_MS, createMenuGreeting } from '../../src/menu/logic/menuGreeting';
import { testMenu } from './menuFixtures';

/**
 * Testy k #170 AC4: Rudy v menu pozdraví při prvním ukázání menu po
 * načtení stránky (po výběru profilu, pokud se ukazuje) a po návratu ze
 * hry jen tehdy, když od posledního pozdravu na téže stránce uběhlo aspoň
 * 10 minut. Po změně profilu ani jazyka ne. Čas (ms) dává test.
 */

const MINUTE = 60_000;

/** Okno s pozdravem, které zaznělo s hlasem. */
const VOICED = { withVoice: true, audioUnlocked: true };

describe('#170 AC4: pozdrav v menu', () => {
  it('pauza mezi pozdravy po návratu ze hry je 10 minut', () => {
    expect(MENU_GREETING_PAUSE_MS).toBe(10 * MINUTE);
  });

  it('při prvním ukázání menu po načtení stránky Rudy pozdraví', () => {
    const greeting = createMenuGreeting();
    expect(greeting.menuShown('shown', 0)).toBe(true);
  });

  it('po výběru profilu na začátku pozdraví jen jednou, další výběr profilu už ne', () => {
    const greeting = createMenuGreeting();
    // Výběr profilu při startu: menu se ukáže až po něm, to je první ukázání.
    expect(greeting.menuShown('shown', 5000)).toBe(true);
    greeting.greeted(5000, VOICED);
    // Dítě později v menu vybere jiný profil: menu se ukáže znovu, bez pozdravu.
    expect(greeting.menuShown('shown', 5000 + 20 * MINUTE)).toBe(false);
  });

  it('po změně profilu se nepozdraví ani tehdy, když první pozdrav nevyšel', () => {
    const greeting = createMenuGreeting();
    expect(greeting.menuShown('shown', 0)).toBe(true);
    expect(greeting.menuShown('shown', 15 * MINUTE)).toBe(false);
  });

  it('po návratu ze hry do 10 minut od pozdravu Rudy nepozdraví', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(0, VOICED);
    expect(greeting.menuShown('returnedFromGame', MINUTE)).toBe(false);
    expect(greeting.menuShown('returnedFromGame', 10 * MINUTE - 1)).toBe(false);
  });

  it('po návratu ze hry po 10 minutách od pozdravu Rudy pozdraví znovu', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(0, VOICED);
    expect(greeting.menuShown('returnedFromGame', 10 * MINUTE)).toBe(true);
  });

  it('10 minut se počítá od posledního pozdravu, ne od prvního', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(0, VOICED);
    expect(greeting.menuShown('returnedFromGame', 12 * MINUTE)).toBe(true);
    greeting.greeted(12 * MINUTE, VOICED);
    expect(greeting.menuShown('returnedFromGame', 20 * MINUTE)).toBe(false);
    expect(greeting.menuShown('returnedFromGame', 22 * MINUTE)).toBe(true);
  });

  it('návrat ze hry bez pozdravu na stránce (okno se nestáhlo) Rudy pozdraví', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    expect(greeting.menuShown('returnedFromGame', MINUTE)).toBe(true);
  });

  it('nesmyslný čas pozdrav po návratu nespustí', () => {
    const greeting = createMenuGreeting();
    greeting.menuShown('shown', 0);
    greeting.greeted(0, VOICED);
    expect(greeting.menuShown('returnedFromGame', Number.NaN)).toBe(false);
  });
});

describe('#170: s rozběhnutým spuštěním hry Rudy v menu nepozdraví', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('v klidném menu se nic nespouští, pozdrav se smí ukázat', () => {
    expect(testMenu().menu.isLaunching()).toBe(false);
  });

  it('po ťuknutí na dlaždici se hra stahuje: pozdrav se neukáže', () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    expect(test.menu.isLaunching()).toBe(true);
  });

  it('hra, která se nestáhla, už spuštění nebrání', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(test.menu.isLaunching()).toBe(false);
  });

  it('běžící hra je spuštění; po návratu do menu už ne', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await vi.advanceTimersByTimeAsync(0);
    expect(test.menu.isLaunching()).toBe(true);
    test.menu.returnFromGame();
    expect(test.menu.isLaunching()).toBe(false);
  });
});
