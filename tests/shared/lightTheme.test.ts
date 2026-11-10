import { describe, expect, it } from 'vitest';

import {
  FONT_FAMILY,
  PAGE_BACKGROUND,
  SETTINGS_GEAR_STYLE,
  colorNumber,
  contrastRatio,
} from '../../src/shared/logic/theme';

/**
 * Testy k #52 pro společný vzhled stránky: kontrast podle WCAG, pozadí,
 * písmo a barvy kolečka nastavení. Vzhled Počítání hlídá
 * `tests/games/counting/lightTheme.test.ts`.
 */

/** WCAG: velký text a grafické prvky 3 : 1. */
const GRAPHIC_CONTRAST = 3;

/** Dnešní zelené barvy pozadí, které na hlavní obrazovce už nesmí zůstat. */
const OLD_GREENS = ['#1f6f43', '#175a36', '#0f3d24'];

/** Barvy porovnáváme bez ohledu na velikost písmen (#f5f5f7 = #F5F5F7). */
function expectColor(actual: string, expected: string): void {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

function isOldGreen(color: string): boolean {
  return OLD_GREENS.includes(color.toLowerCase());
}

describe('kontrastní poměr podle WCAG', () => {
  it('černá na bílé má největší kontrast 21 : 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('barva sama se sebou má kontrast 1 : 1', () => {
    expect(contrastRatio('#86868B', '#86868B')).toBeCloseTo(1, 5);
  });

  it('nezáleží na pořadí barev ani na velikosti písmen', () => {
    expect(contrastRatio('#f5f5f7', '#86868b')).toBeCloseTo(
      contrastRatio('#86868B', '#F5F5F7'),
      10,
    );
  });

  it('šedá #86868B na pozadí #F5F5F7 má 3,33 : 1 jako v zadání', () => {
    expect(contrastRatio('#86868B', '#F5F5F7')).toBeCloseTo(3.33, 2);
  });

  it('modrá #0062CC na pozadí #F5F5F7 má 5,3 : 1 jako v zadání', () => {
    expect(contrastRatio('#0062CC', '#F5F5F7')).toBeCloseTo(5.33, 1);
  });

  it('barvu z tématu jde předat Phaseru jako číslo', () => {
    expect(colorNumber('#F5F5F7')).toBe(0xf5f5f7);
    expect(colorNumber('#248a3d')).toBe(0x248a3d);
  });
});

describe('#52 AC1: světlé pozadí a systémové písmo', () => {
  it('stránka i herní plocha mají světlé pozadí #F5F5F7', () => {
    expectColor(PAGE_BACKGROUND, '#F5F5F7');
  });

  it('střed kolečka nastavení není zelený, má barvu pozadí #F5F5F7', () => {
    expectColor(SETTINGS_GEAR_STYLE.centerColor, '#F5F5F7');
    expect(isOldGreen(SETTINGS_GEAR_STYLE.centerColor)).toBe(false);
  });

  it('texty mají systémové písmo ze zadání', () => {
    expect(FONT_FAMILY).toBe(
      '-apple-system, "SF Pro Rounded", "Helvetica Neue", system-ui, sans-serif',
    );
  });
});

describe('#52 AC7: psaní prstem a ovládání ve světlém vzhledu', () => {
  it('kroužek, který se plní při podržení kolečka, je modrý #0062CC s kontrastem aspoň 3 : 1', () => {
    expectColor(SETTINGS_GEAR_STYLE.holdRingColor, '#0062CC');
    expect(
      contrastRatio(SETTINGS_GEAR_STYLE.holdRingColor, PAGE_BACKGROUND),
    ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  });
});
