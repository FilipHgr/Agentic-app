import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHoldButton } from '../../src/shared/logic/holdButton';

/**
 * Test k #129 (nález z kontroly ve skutečné hře): na vytížené stránce
 * (pomalé vykreslování) se časovač podržení zpozdí a prohlížeč zpracuje
 * zvednutí prstu dřív než časovač. Prst držený celou dobu podržení se pak
 * dřív počítal jako ťuknutí a koš nic nesmazal. Platí pro všechna tlačítka
 * s podržením (domeček, koš, „Smazat“ u profilu).
 */

const HOLD_MS = 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function button() {
  const events: string[] = [];
  const hold = createHoldButton({
    holdMs: HOLD_MS,
    onHoldComplete: () => events.push('podrženo'),
    onTap: () => events.push('ťuknutí'),
    onHoldingChange: (holding) => events.push(holding ? 'kroužek' : 'bez kroužku'),
  });
  return { hold, events };
}

/** Hodiny stránky běží, ale časovače se nespustí (stránka vykresluje). */
function busyPageFor(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

describe('#129: podržení na vytížené stránce', () => {
  it('prst zvednutý po celé době podržení se počítá jako podržení, i když se časovač zpozdil', () => {
    const { hold, events } = button();

    hold.press(1);
    busyPageFor(HOLD_MS + 200);
    hold.release(1);
    vi.advanceTimersByTime(HOLD_MS);

    expect(events).toEqual(['kroužek', 'bez kroužku', 'podrženo']);
  });

  it('prst zvednutý dřív než po celé době je pořád jen ťuknutí', () => {
    const { hold, events } = button();

    hold.press(1);
    busyPageFor(HOLD_MS - 1);
    hold.release(1);
    vi.advanceTimersByTime(HOLD_MS);

    expect(events).toEqual(['kroužek', 'bez kroužku', 'ťuknutí']);
  });

  it('prst, který sjel z tlačítka, se nepočítá, ani když se pak zvedne po celé době', () => {
    const { hold, events } = button();

    hold.press(1);
    hold.leave(1);
    busyPageFor(HOLD_MS + 200);
    hold.release(1);
    vi.advanceTimersByTime(HOLD_MS);

    expect(events).toEqual(['kroužek', 'bez kroužku']);
  });

  it('přerušený dotyk se nepočítá, ani když se pak prst zvedne po celé době', () => {
    const { hold, events } = button();

    hold.press(1);
    hold.cancel(1);
    busyPageFor(HOLD_MS + 200);
    hold.release(1);
    vi.advanceTimersByTime(HOLD_MS);

    expect(events).toEqual(['kroužek', 'bez kroužku']);
  });
});
