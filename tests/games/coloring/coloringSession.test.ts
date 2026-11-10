import { describe, expect, it } from 'vitest';

import { startColoringSession } from '../../../src/games/coloring/logic/coloringSession';
import type { ColoringPage } from '../../../src/games/coloring/logic/coloringSession';

/**
 * Testy k #88 AC6 (domeček podržením vrací do menu jako v Počítání,
 * v Omalovánkách není kolečko nastavení). Podržení domečku a odchod do menu
 * jsou společné pro všechny hry (`src/shared/logic/homeButton.ts`,
 * `src/shared/ui/gameSession.ts`, testy v `tests/shared/`); hra jen ohlásí,
 * že domeček jde použít. Že stránka kolečko bez napojené hry neukáže,
 * hlídá `tests/shared/settingsGearShown.test.ts`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloringSession.ts`, bez Phaseru):
 * - `ColoringPage = Pick<GameHost, 'setHomeAvailable' | 'attachSettingsGear' | 'onLeave'>`,
 * - `startColoringSession(page: ColoringPage): ColoringSession`; při startu
 *   ohlásí domeček jako použitelný a na kolečko se nenapojí.
 */

interface FakePage extends ColoringPage {
  readonly homeReports: boolean[];
  readonly gearAttachments: number;
}

function fakePage(): FakePage {
  const homeReports: boolean[] = [];
  let gearAttachments = 0;
  return {
    homeReports,
    get gearAttachments() {
      return gearAttachments;
    },
    setHomeAvailable: (available) => {
      homeReports.push(available);
    },
    attachSettingsGear: () => {
      gearAttachments += 1;
      return () => undefined;
    },
    onLeave: () => undefined,
  };
}

describe('#88 AC6: domeček v Omalovánkách', () => {
  it('po otevření omalovánky jde domečkem hned odejít do menu', () => {
    const page = fakePage();
    startColoringSession(page);
    expect(page.homeReports.at(-1)).toBe(true);
  });
});

describe('#88 AC6: v Omalovánkách kolečko nastavení není', () => {
  it('Omalovánky se na kolečko nastavení nenapojí', () => {
    const page = fakePage();
    startColoringSession(page);
    expect(page.gearAttachments).toBe(0);
  });
});
