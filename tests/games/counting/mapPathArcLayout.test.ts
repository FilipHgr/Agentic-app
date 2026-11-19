import { describe, expect, it } from 'vitest';

import { layoutMapScenery } from '../../../src/games/counting/logic/mapScenery';
import type { SceneryBox } from '../../../src/games/counting/logic/mapScenery';
import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import { pathPointAt } from '../../../src/games/counting/logic/progressMapLayout';
import type { MapPoint } from '../../../src/games/counting/logic/progressMapLayout';
import type { Box } from '../../shared/viewportFixtures';
import { cornerItems } from './layoutScenes';
import { cardBox, cardWindowCase } from './mapCardScenes';
import { placeName } from './mapLayoutScenes';
import { drawnMarkerSize, drawnPlaceSize } from './mapPictureLayoutScenes';
import {
  MAP_WINDOWS,
  SEGMENT_COUNT,
  arcCases,
  arcSamples,
  distance,
  polylineLength,
  segmentName,
} from './mapPathHelpers';
import type { ArcCase } from './mapPathHelpers';

/**
 * Testy k #146 AC2: pruh cesty po oblouku, široký jako nakreslená značka
 * (i s okrajem a poskočením, jako v #136 AC2), se v kartě (#145) ve všech
 * oknech mapy z #133 AC7 a na 5 mapách nepřekrývá s místy (kromě dvou
 * krajních míst úseku), se symbolem cíle a slavícím cílem, s místem klíče,
 * s plochami kousků prostředí, s rohem kolečka a domečku, výřezem a lištou
 * a nevyčnívá z plochy mapy (karty).
 *
 * Pruh je všechno, kudy projde kruh značky, když jde po oblouku; měří se
 * v CSS px v bodech oblouku nejvýš 1 CSS px od sebe. Místa a slavící cíl
 * jsou kruhy (tak se kreslí), klíč, kousky prostředí a rohy obdélníky.
 * Pravidla míst, klíče a prostředí (#133 AC7, #134 AC2, #135 AC3, #136 AC2,
 * #139 AC2) hlídají jejich vlastní testy; místa se smějí posunout.
 *
 * Kroky 0–3: pruh, místa, cíl, klíč i prostředí na kroku značky nezávisí
 * (rozložení mapy kreslí vždy celou cestu), proto se každá mapa měří
 * jednou; značka stojící na místě patří k místu (hlídá #133 AC7).
 * Konec pruhu u cíle (kde stojí značka v cíli) smí slavící cíl překrýt,
 * stejně jako ho smí překrýt značka v cíli (#135 AC3).
 *
 * Každé pravidlo má jeden test, který v cyklu projde všechny případy;
 * popis případu je ve zprávě `expect`.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE_CSS = 0.01;

/** Nejvýš jak daleko od sebe jsou body oblouku, ve kterých se pruh měří, v CSS px. */
const SAMPLE_STEP_CSS = 1;

function toCssPoint(arc: ArcCase, point: MapPoint): MapPoint {
  return {
    x: arc.area.offsetX + point.x * arc.area.scale,
    y: arc.area.offsetY + point.y * arc.area.scale,
  };
}

/** Body oblouku úseku v CSS px okna, nejvýš 1 CSS px od sebe. */
function cssSamples(arc: ArcCase, segment: number): MapPoint[] {
  const lengthCss = polylineLength(arcSamples(arc.layout, segment, 200)) * arc.area.scale;
  const count = Math.max(1, Math.ceil(lengthCss / SAMPLE_STEP_CSS));
  return Array.from({ length: count + 1 }, (_, index) =>
    toCssPoint(arc, pathPointAt(arc.layout, segment, index / count)),
  );
}

/** Poloměr pruhu v CSS px: půl nakreslené značky. */
function pruhRadiusCss(arc: ArcCase): number {
  return (drawnMarkerSize(arc.layout) / 2) * arc.area.scale;
}

/** Vzdálenost bodu od obdélníku (0 uvnitř). */
function pointBoxDistance(point: MapPoint, area: Box): number {
  const dx = Math.max(area.left - point.x, 0, point.x - area.right);
  const dy = Math.max(area.top - point.y, 0, point.y - area.bottom);
  return Math.hypot(dx, dy);
}

/** Překážka: kruh, nebo obdélník v CSS px. */
type Obstacle =
  | { readonly name: string; readonly circle: MapPoint & { readonly radius: number } }
  | { readonly name: string; readonly box: Box };

/** O kolik pruh zasahuje do překážky v bodě oblouku `point` (kladné = překryv). */
function overlapAt(point: MapPoint, radius: number, obstacle: Obstacle): number {
  if ('circle' in obstacle) {
    return radius + obstacle.circle.radius - distance(point, obstacle.circle);
  }
  return radius - pointBoxDistance(point, obstacle.box);
}

/**
 * Kde pruh zasahuje do překážek, popis pro `expect`. `skip` vynechá body,
 * které k překážce patří (konec úseku u cíle se slavícím cílem).
 */
function pruhHits(
  arc: ArcCase,
  obstaclesFor: (segment: number) => readonly Obstacle[],
  skip: (segment: number, point: MapPoint) => boolean = () => false,
): string[] {
  const radius = pruhRadiusCss(arc);
  const hits = new Set<string>();
  for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
    const obstacles = obstaclesFor(segment);
    for (const point of cssSamples(arc, segment)) {
      if (skip(segment, point)) {
        continue;
      }
      for (const obstacle of obstacles) {
        const overlap = overlapAt(point, radius, obstacle);
        if (overlap > TOLERANCE_CSS) {
          hits.add(`${segmentName(segment)} zasahuje do: ${obstacle.name}`);
        }
      }
    }
  }
  return [...hits];
}

function circleOf(arc: ArcCase, center: MapPoint, size: number, name: string): Obstacle {
  const css = toCssPoint(arc, center);
  return { name, circle: { ...css, radius: (size / 2) * arc.area.scale } };
}

function sceneryBoxCss(arc: ArcCase, area: SceneryBox): Box {
  const { scale, offsetX, offsetY } = arc.area;
  return {
    left: offsetX + area.left * scale,
    right: offsetX + area.right * scale,
    top: offsetY + area.top * scale,
    bottom: offsetY + area.bottom * scale,
  };
}

/** Je bod oblouku pod značkou stojící v cíli (konec posledního úseku)? */
function isUnderMarkerInGoal(arc: ArcCase, segment: number, point: MapPoint): boolean {
  if (segment !== MAP_STEPS - 1) {
    return false;
  }
  const goal = toCssPoint(arc, arc.layout.places[MAP_STEPS] ?? { x: Infinity, y: Infinity });
  return distance(point, goal) <= pruhRadiusCss(arc);
}

describe('#146 AC2: pruh cesty široký jako značka se v kartě s ničím nepřekrývá', () => {
  it('v kartě jsou všechna okna mapy a všech 5 map', () => {
    expect(arcCases().length).toBe(MAP_WINDOWS.length * 5);
  });

  it('pruh cesty nepřekryje žádné místo kromě dvou krajních míst svého úseku', () => {
    for (const arc of arcCases()) {
      const hits = pruhHits(arc, (segment) =>
        arc.layout.places
          .map((place, step) => ({ place, step }))
          .filter(({ step }) => step !== segment && step !== segment + 1)
          .map(({ place, step }) =>
            circleOf(arc, place, drawnPlaceSize(arc.layout, step), placeName(step)),
          ),
      );
      expect(hits, arc.label).toEqual([]);
    }
  });

  it('pruh cesty nepřekryje symbol cíle ani slavící cíl se září (#135 AC3)', () => {
    for (const arc of arcCases()) {
      const { goalSymbol, goalCelebration } = arc.layout;
      const obstacles = [
        circleOf(arc, goalSymbol, goalSymbol.size, 'symbol cíle'),
        circleOf(arc, goalCelebration, goalCelebration.size, 'slavící cíl'),
      ];
      const hits = pruhHits(
        arc,
        () => obstacles,
        (segment, point) => isUnderMarkerInGoal(arc, segment, point),
      );
      expect(hits, arc.label).toEqual([]);
    }
  });

  it('pruh cesty nepřekryje místo klíče u cíle (#139 AC2)', () => {
    for (const arc of arcCases()) {
      const key = arc.layout.goalKey;
      const keyBox: Box = {
        left: arc.area.offsetX + (key.x - key.width / 2) * arc.area.scale,
        right: arc.area.offsetX + (key.x + key.width / 2) * arc.area.scale,
        top: arc.area.offsetY + (key.y - key.height / 2) * arc.area.scale,
        bottom: arc.area.offsetY + (key.y + key.height / 2) * arc.area.scale,
      };
      const hits = pruhHits(arc, () => [{ name: 'štítek klíče', box: keyBox }]);
      expect(hits, arc.label).toEqual([]);
    }
  });

  it('pruh cesty nepřekryje plochu, kterou projde kousek prostředí, ani jeho pruh (#136 AC2)', () => {
    for (const arc of arcCases()) {
      const scenery = layoutMapScenery(arc.area, arc.theme, arc.layout);
      const obstacles: Obstacle[] = scenery.pieces.flatMap((piece, index) => {
        const name = `${piece.kind} ${index + 1}`;
        const sweep: Obstacle = {
          name: `plocha pohybu ${name}`,
          box: sceneryBoxCss(arc, piece.sweep),
        };
        return piece.lane
          ? [sweep, { name: `pruh ${name}`, box: sceneryBoxCss(arc, piece.lane) }]
          : [sweep];
      });
      expect(scenery.pieces.length, arc.label).toBeGreaterThan(0);
      expect(
        pruhHits(arc, () => obstacles),
        arc.label,
      ).toEqual([]);
    }
  });

  it('pruh cesty nezasahuje do rohu kolečka a domečku, do výřezu ani na lištu', () => {
    for (const arc of arcCases()) {
      const { gameArea } = cardWindowCase(arc.window);
      const { safeArea, width, height } = arc.window;
      const notch: Obstacle[] = [
        { name: 'výřez nahoře', box: { left: 0, right: width, top: -1e6, bottom: safeArea.top } },
        { name: 'výřez vlevo', box: { left: -1e6, right: safeArea.left, top: 0, bottom: height } },
        {
          name: 'výřez vpravo',
          box: { left: width - safeArea.right, right: 1e6, top: 0, bottom: height },
        },
        {
          name: 'lišta dole',
          box: { left: 0, right: width, top: height - safeArea.bottom, bottom: 1e6 },
        },
      ];
      const corners: Obstacle[] = cornerItems(arc.window, gameArea).map((item) => ({
        name: item.name,
        box: item.box,
      }));
      expect(
        pruhHits(arc, () => [...corners, ...notch]),
        arc.label,
      ).toEqual([]);
    }
  });

  it('pruh cesty nevyčnívá z plochy mapy v kartě', () => {
    for (const arc of arcCases()) {
      const card = cardBox(arc.card);
      const radius = pruhRadiusCss(arc);
      const overhangs = new Set<string>();
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        for (const point of cssSamples(arc, segment)) {
          const sides: Array<[string, number]> = [
            ['vlevo', card.left - (point.x - radius)],
            ['vpravo', point.x + radius - card.right],
            ['nahoře', card.top - (point.y - radius)],
            ['dole', point.y + radius - card.bottom],
          ];
          for (const [side, overhang] of sides) {
            if (overhang > TOLERANCE_CSS) {
              overhangs.add(`${segmentName(segment)} vyčnívá ${side}`);
            }
          }
        }
      }
      expect([...overhangs], arc.label).toEqual([]);
    }
  });
});
