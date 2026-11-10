import { describe, expect, it, vi } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { IPAD_WINDOWS, freeAreaOf, viewportOf } from '../../shared/viewportFixtures';

/**
 * Test k #96 AC1 (technické rozhodnutí 1): Omalovánky si ve vstupu hry
 * řeknou o herní plochu přes celé okno, takže na iPadu dostanou celou
 * volnou plochu. Scéna potřebuje Phaser a prohlížeč, v testu ji nahradí
 * prázdná třída; zkouší se jen to, co vstup hry vydává stránce.
 */

vi.mock('../../../src/games/coloring/scenes/ColoringScene', () => ({
  ColoringScene: class {},
}));

describe('#96 AC1: Omalovánky mají herní plochu přes celé okno', () => {
  it('vstup hry vydává `gameAreaFit: fullWindow`, iPad tak dostane celou volnou plochu', async () => {
    const coloring = await import('../../../src/games/coloring');
    expect(coloring.gameAreaFit).toBe('fullWindow');
    expect(coloring.scenes.length).toBeGreaterThan(0);
    for (const window of IPAD_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), coloring.gameAreaFit);
      const free = freeAreaOf(window);
      expect(area.width * area.scale, window.name).toBeCloseTo(free.right - free.left, 0);
      expect(area.height * area.scale, window.name).toBeCloseTo(free.bottom - free.top, 0);
    }
  });
});
