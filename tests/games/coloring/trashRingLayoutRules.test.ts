import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import { layoutBigPicture, trashHoldRingFor } from '../../../src/games/coloring/logic/pickerLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { MIN_TAP_GAP } from '../../shared/layoutRules';
import { freeAreaOf, toCss, viewportOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, boxOfRect } from './coloringLayoutScenes';

/**
 * Pravidla rozložení kroužku podržení kolem koše (#129 AC6 a AC7, schválený
 * prototyp `129-podrzeni-kose.png`): kroužek je vně koše na pozadí stránky
 * a ve všech oknech Omalovánek se celý vejde na obrazovku, nepřekryje velký
 * obrázek a nezasáhne do domečku ani 8 px kolem něj. Měří se vnější okraj
 * kroužku i s tmavým okrajem. Jeden test na pravidlo, okna v cyklu.
 */

interface RingCase {
  readonly label: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly trash: Box;
  readonly picture: Box;
  readonly home: Box;
  readonly visible: Box;
}

function ringCase(window: (typeof COLORING_WINDOWS)[number]): RingCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutBigPicture(area);
  const ring = trashHoldRingFor(layout, area);
  const center = toCss(
    { left: ring.centerX, right: ring.centerX, top: ring.centerY, bottom: ring.centerY },
    area,
  );
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  const home = homeButtonFor(viewportOf(window));
  return {
    label: `${window.name}, kroužek koše`,
    centerX: center.left,
    centerY: center.top,
    outerRadius: ring.outerRadius * area.scale,
    innerRadius: (ring.radius - ring.lineWidth / 2) * area.scale,
    trash: toCss(boxOfRect(layout.trash), area),
    picture: toCss(boxOfRect(layout.picture), area),
    home: {
      left: home.left - MIN_TAP_GAP,
      right: home.left + home.hitSize + MIN_TAP_GAP,
      top: home.top - MIN_TAP_GAP,
      bottom: home.top + home.hitSize + MIN_TAP_GAP,
    },
    visible: {
      left: Math.max(free.left, plane.left),
      right: Math.min(free.right, plane.right),
      top: Math.max(free.top, plane.top),
      bottom: Math.min(free.bottom, plane.bottom),
    },
  };
}

/** Vzdálenost středu kruhu od obdélníku (0 uvnitř). */
function distanceToBox(x: number, y: number, box: Box): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
}

const cases = COLORING_WINDOWS.map(ringCase);

describe('#129: kroužek podržení kolem koše', () => {
  it('kroužek je vně koše: obepíná strany tlačítka', () => {
    for (const each of cases) {
      const halfSide = (each.trash.right - each.trash.left) / 2;
      expect(each.innerRadius, each.label).toBeGreaterThan(halfSide);
    }
  });

  it('kroužek se celý vejde do bezpečné plochy', () => {
    for (const each of cases) {
      const { visible } = each;
      expect(each.centerX - each.outerRadius, `${each.label}, vlevo`).toBeGreaterThanOrEqual(
        visible.left - 0.01,
      );
      expect(each.centerX + each.outerRadius, `${each.label}, vpravo`).toBeLessThanOrEqual(
        visible.right + 0.01,
      );
      expect(each.centerY - each.outerRadius, `${each.label}, nahoře`).toBeGreaterThanOrEqual(
        visible.top - 0.01,
      );
      expect(each.centerY + each.outerRadius, `${each.label}, dole`).toBeLessThanOrEqual(
        visible.bottom + 0.01,
      );
    }
  });

  it('kroužek nepřekryje velký obrázek', () => {
    for (const each of cases) {
      expect(
        distanceToBox(each.centerX, each.centerY, each.picture),
        each.label,
      ).toBeGreaterThanOrEqual(each.outerRadius - 0.01);
    }
  });

  it('kroužek nezasáhne do domečku ani 8 px kolem něj', () => {
    for (const each of cases) {
      expect(
        distanceToBox(each.centerX, each.centerY, each.home),
        each.label,
      ).toBeGreaterThanOrEqual(each.outerRadius - 0.01);
    }
  });
});
