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
 *
 * #63: snapshot herní obrazovky se vědomě aktualizuje
 * (větší příklad uprostřed, nápověda od spodku boxu textu). Že se hvězdičky
 * a ovládání nepohnuly, hlídá natvrdo `biggerProblem.test.ts`. Snapshot
 * herní plochy (první test) zůstává beze změny.
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
    '$name: hvězdičky, příklad, nápověda, číselník i okénka na psaní mají velikost a polohu podle snapshotu',
    (window) => {
      const placement = todayFitPlacement(window.width, window.height);

      expect(tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, placement)).toMatchSnapshot();
    },
  );
});
