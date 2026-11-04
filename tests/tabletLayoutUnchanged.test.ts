import { describe, expect, it } from 'vitest';

import { tabletCssLayouts } from './tabletSnapshot';
import {
  IPAD_WINDOWS,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  todayFitPlacement,
} from './viewportFixtures';

/**
 * Testy k #54, AC5 (iPad se nemění): velikosti a polohy všech prvků na
 * iPadu na šířku v oknech 1180×820 a 1180×760 v CSS px, zafixované
 * snapshotem z rozložení před změnou (Phaser Scale.FIT 1024 × 768 na střed
 * okna). Test používá jen dnešní funkce, takže projde před změnou i po ní.
 * Že nová volba rozložení dá iPadu právě tohle, ověřuje deviceLayout.test.ts.
 */

describe('AC5: na iPadu na šířku se nic nemění', () => {
  it.each(IPAD_WINDOWS)(
    '$name: herní plocha je na stejném místě a stejně velká jako před změnou',
    (window) => {
      const placement = todayFitPlacement(window.width, window.height);

      expect({
        width: TODAY_GAME_WIDTH * placement.scale,
        height: TODAY_GAME_HEIGHT * placement.scale,
        ...placement,
      }).toMatchSnapshot();
    },
  );

  it.each(IPAD_WINDOWS)(
    '$name: hvězdičky, postavička, příklad, nápověda, číselník i okénka na psaní mají stejnou velikost a polohu jako před změnou',
    (window) => {
      const placement = todayFitPlacement(window.width, window.height);

      expect(tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, placement)).toMatchSnapshot();
    },
  );
});
