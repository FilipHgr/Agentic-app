import { describe, expect, it } from 'vitest';

import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { PHONE_WINDOWS, freeAreaOf, viewportOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #68 (domeček ve hře), AC1 a AC4.
 *
 * Že nic ze hry neleží v rohu domečku (na šířku 88 × 88 px vlevo nahoře,
 * na výšku plocha domečku a 4 px kolem ní, na iPadu plocha domečku), ve
 * všech oknech, rozsazích, ovládáních, s prázdnou i plnou řadou hvězdiček,
 * bez nápovědy i s ní, hlídá od #81 pravidlo „nic se nepřekrývá“
 * v `countingLayoutRules.test.ts` (roh domečku je tam vyhrazený prvek).
 * Tady zůstává, že domeček sám leží ve svém rohu.
 */

/** Strana volného rohu na šířku, stejná jako u kolečka (#54). */
const LANDSCAPE_CORNER_SIZE = 88;

/** Plocha pro prst u domečku v CSS px okna. */
function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

describe('AC4: na telefonu na šířku je domeček v levém horním rohu', () => {
  it('plocha domečku je celá v rohu domečku 88 × 88 px', () => {
    for (const window of PHONE_WINDOWS) {
      const hit = homeHitOf(window);
      const free = freeAreaOf(window);

      expect(hit.left, window.name).toBeGreaterThanOrEqual(free.left);
      expect(hit.right, window.name).toBeLessThanOrEqual(free.left + LANDSCAPE_CORNER_SIZE);
      expect(hit.bottom, window.name).toBeLessThanOrEqual(free.top + LANDSCAPE_CORNER_SIZE);
    }
  });
});
