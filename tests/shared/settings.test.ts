import { describe, expect, it } from 'vitest';

import { HOLD_TO_OPEN_SETTINGS_MS, isHoldLongEnough } from '../../src/shared/logic/settingsGear';

/**
 * Testy k #36: podržení kolečka nastavení na stránce. Ostatní testy
 * nastavení Počítání jsou v `tests/games/counting/settings.test.ts`.
 */

describe('AC1: nastavení se otevře až po podržení kolečka', () => {
  it('rodič musí kolečko držet 1 sekundu', () => {
    expect(HOLD_TO_OPEN_SETTINGS_MS).toBe(1000);
  });

  it('krátké ťuknutí ani držení kratší než 1 sekunda nastavení neotevře', () => {
    for (const heldMs of [0, 150, 500, 999]) {
      expect(isHoldLongEnough(heldMs)).toBe(false);
    }
  });

  it('když rodič podrží kolečko 1 sekundu a déle, nastavení se otevře', () => {
    expect(isHoldLongEnough(1000)).toBe(true);
    expect(isHoldLongEnough(2000)).toBe(true);
    expect(isHoldLongEnough(3500)).toBe(true);
  });

  it('nesmyslná doba držení nastavení neotevře a nespadne', () => {
    expect(isHoldLongEnough(Number.NaN)).toBe(false);
    expect(isHoldLongEnough(-5)).toBe(false);
  });
});
