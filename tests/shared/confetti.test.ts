import { describe, expect, it } from 'vitest';

import { CONFETTI_COLORS } from '../../src/shared/logic/confetti';
import { PAGE_BACKGROUND, contrastRatio } from '../../src/shared/logic/theme';

/**
 * Konfety oslavy společné pro hry (#177, přesunuto z testů Počítání #53 AC5).
 */

/** WCAG: grafické prvky 3 : 1. */
const GRAPHIC_CONTRAST = 3;

/** Dnešní barvy konfet, které na světlém pozadí splývají. */
const OLD_CONFETTI_COLORS = ['#ffd54f', '#81d4fa', '#ff8a80', '#b9f6ca', '#ce93d8', '#ffffff'];

describe('#53 AC5: konfety jsou na světlém pozadí vidět', () => {
  it('konfety mají modrou, zelenou, červenou, fialovou, oranžovou a zlatou ze zadání', () => {
    const colors = CONFETTI_COLORS.map((color) => color.toLowerCase()).sort();
    expect(colors).toEqual(
      ['#0062CC', '#248A3D', '#FF3B30', '#AF52DE', '#C93400', '#A67C00']
        .map((color) => color.toLowerCase())
        .sort(),
    );
  });

  it('každá konfeta má proti pozadí kontrast aspoň 3 : 1', () => {
    for (const color of CONFETTI_COLORS) {
      expect(contrastRatio(color, PAGE_BACKGROUND), color).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    }
  });

  it('žádná konfeta není bílá, žlutá #FFCC00 ani v barvě pozadí', () => {
    for (const color of CONFETTI_COLORS) {
      expect(['#ffffff', '#ffcc00', PAGE_BACKGROUND.toLowerCase()]).not.toContain(
        color.toLowerCase(),
      );
    }
  });

  it('žádná konfeta nemá dnešní bledou barvu', () => {
    for (const color of CONFETTI_COLORS) {
      expect(OLD_CONFETTI_COLORS, color).not.toContain(color.toLowerCase());
    }
  });

  it('každá konfeta má jinou barvu', () => {
    const colors = CONFETTI_COLORS.map((color) => color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });
});
