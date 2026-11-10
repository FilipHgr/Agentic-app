import { describe, expect, it } from 'vitest';

import { startScreenFor } from '../../src/menu/logic/profileScreens';
import type { StartScreen } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';

/**
 * Test k #78 AC2: aplikace z plochy se po ťuknutí otevře jako nové načtení
 * stránky. Úvodní adresu (kořen stránky, ne hra) hlídá
 * `tests/shared/homeScreenApp.test.ts`. Tady: co stránka ukáže po startu,
 * záleží jen na počtu profilů (#72), nikdy to není rovnou hra, i když ji
 * rodič přidal na plochu uprostřed hry.
 */

function profiles(count: number): Profile[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `profil${index + 1}`,
    nickname: `DITE ${index + 1}`,
    color: PROFILE_COLORS[index % PROFILE_COLORS.length] ?? PROFILE_COLORS[0],
  }));
}

describe('#78 AC2: aplikace z plochy začne výběrem profilu nebo menu', () => {
  it('po startu je výběr profilu (dva a víc profilů) nebo menu, nikdy rovnou hra', () => {
    const cases: Array<[number, StartScreen]> = [
      [0, 'menu'],
      [1, 'menu'],
      [2, 'profilePicker'],
      [6, 'profilePicker'],
    ];
    for (const [count, expected] of cases) {
      expect(startScreenFor(profiles(count)), `${count} profilů`).toBe(expected);
    }
  });
});
