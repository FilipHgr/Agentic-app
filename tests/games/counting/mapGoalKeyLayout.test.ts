import { describe, expect, it } from 'vitest';

import keySvg from '../../../src/games/counting/icons/key.svg?raw';
import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import { MAP_PATH_WIDTH_SHARE } from '../../../src/games/counting/logic/progressMapLayout';
import { LAYOUT_RULES } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, heightOf, toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';
import { MARKER_NAME, placeName } from './mapLayoutScenes';
import { drawnMarkerSize, drawnPlaceSize, pictureMapCases } from './mapPictureLayoutScenes';
import type { PictureMapCase } from './mapPictureLayoutScenes';
import { licenceParagraphsWith } from './mapPictureHelpers';

/**
 * Testy k #139 AC2 (rozložení): půlka klíče stojí na štítku vedle
 * slavícího cíle a nepřekrývá cíl, místa na cestě, značku v cíli, roh
 * kolečka a domečku ani okraj. Každé společné pravidlo rozložení má jeden
 * test, který v cyklu projde všechna okna mapy a 5 map. Klíč ze sady Noto
 * je uložený v repozitáři a jeho původ je v `public/licence.txt`.
 * Vzhled půlky a spojení půlek je ruční kontrola.
 */

const KEY_NAME = 'štítek klíče';
const CELEBRATING_GOAL_NAME = 'slavící symbol cíle';

/** Nejmenší výška štítku klíče v CSS px, aby byl klíč dobře vidět. */
const MIN_KEY_HEIGHT_CSS = 36;

/** Nejmenší mezera mezi štítkem klíče a čárou cesty v CSS px. */
const MIN_PATH_GAP_CSS = 8;

/** Po kolika CSS px se cesta měří. */
const PATH_SAMPLE_CSS = 0.5;

/** Vzdálenost bodu od obdélníku v CSS px (0 uvnitř). */
function distanceToBox(x: number, y: number, target: Box): number {
  const dx = Math.max(target.left - x, 0, x - target.right);
  const dy = Math.max(target.top - y, 0, y - target.bottom);
  return Math.hypot(dx, dy);
}

/** Nejmenší vzdálenost osy cesty od štítku klíče v CSS px (cesta měřená po kouscích). */
function pathDistanceToKey(testCase: PictureMapCase): number {
  const { area, layout } = testCase;
  const key = keyBox(testCase);
  const points = layout.places.map((place) => toCss(box(place.x, place.y, 0, 0), area));
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) {
      continue;
    }
    const length = Math.hypot(to.left - from.left, to.top - from.top);
    const samples = Math.max(1, Math.ceil(length / PATH_SAMPLE_CSS));
    for (let sample = 0; sample <= samples; sample += 1) {
      const share = sample / samples;
      const x = from.left + (to.left - from.left) * share;
      const y = from.top + (to.top - from.top) * share;
      nearest = Math.min(nearest, distanceToBox(x, y, key));
    }
  }
  return nearest;
}

function keyBox(testCase: PictureMapCase): Box {
  const { x, y, width, height } = testCase.layout.goalKey;
  return toCss(box(x, y, width, height), testCase.area);
}

/** Obrazovka cíle: kolečko a domeček, místa, značka v cíli, slavící cíl a štítek klíče. */
function goalKeyScene(testCase: PictureMapCase): LayoutScene {
  const { window, area, layout } = testCase;
  const places: LayoutItem[] = layout.places.map((place, step) => {
    const size = drawnPlaceSize(layout, step);
    return { name: placeName(step), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const goal = layout.places[MAP_STEPS] ?? { x: 0, y: 0 };
  const markerSize = drawnMarkerSize(layout);
  const celebration = layout.goalCelebration;
  const goalItems: LayoutItem[] = [
    { name: MARKER_NAME, box: toCss(box(goal.x, goal.y, markerSize, markerSize), area) },
    {
      name: CELEBRATING_GOAL_NAME,
      box: toCss(box(celebration.x, celebration.y, celebration.size, celebration.size), area),
    },
    { name: KEY_NAME, box: keyBox(testCase) },
  ];
  const goalPlace = placeName(MAP_STEPS);
  // Značka stojí v cíli a smí překrýt cíl i záři kolem něj (#133, #135); klíč nic.
  const mayShare = new Set([MARKER_NAME, goalPlace, CELEBRATING_GOAL_NAME]);
  return {
    label: `${testCase.label}, značka v cíli, půlka klíče`,
    free: visibleAreaOf(window, area),
    items: [...cornerItems(window, area), ...places, ...goalItems],
    mayOverlap: (first, second) =>
      (mayShare.has(first.name) && mayShare.has(second.name)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
  };
}

let cached: PictureMapCase[] | undefined;

function cases(): PictureMapCase[] {
  cached ??= pictureMapCases();
  return cached;
}

describe('#139 AC2: půlka klíče stojí u cíle a nic nepřekrývá', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: štítek klíče ve všech oknech a na každé z 5 map`, () => {
      expect(cases().length).toBeGreaterThan(0);
      for (const testCase of cases()) {
        const scene = goalKeyScene(testCase);
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('štítek klíče nepřekrývá čáru cesty a drží od ní aspoň 8 px', () => {
    for (const testCase of cases()) {
      const halfLine =
        (testCase.layout.markerSize * MAP_PATH_WIDTH_SHARE * testCase.area.scale) / 2;
      expect(pathDistanceToKey(testCase), testCase.label).toBeGreaterThanOrEqual(
        halfLine + MIN_PATH_GAP_CSS - PATH_SAMPLE_CSS,
      );
    }
  });

  it('štítek klíče je dost velký, aby byl klíč dobře vidět', () => {
    for (const testCase of cases()) {
      expect(heightOf(keyBox(testCase)), testCase.label).toBeGreaterThanOrEqual(
        MIN_KEY_HEIGHT_CSS - 1e-6,
      );
    }
  });
});

describe('#139 AC2: klíč je obrázek Noto Emoji uložený v repozitáři', () => {
  it('soubor klíče je SVG bez odkazů na cizí servery', () => {
    expect(keySvg.startsWith('<svg')).toBe(true);
    const references = (keySvg.match(/(?:href|src|url)\s*[=(]\s*["']?[^"')\s>]+/g) ?? []).filter(
      (reference) => !reference.includes('#'),
    );
    expect(references).toEqual([]);
  });

  it('licence uvádí klíč u obrázků Noto Emoji s licencí Apache-2.0', () => {
    const paragraph = licenceParagraphsWith('Noto Emoji').find((text) =>
      text.includes('src/games/counting/icons/'),
    );
    expect(paragraph, 'odstavec s klíčem').toBeDefined();
    expect(paragraph ?? '', 'jméno ikony Noto').toMatch(/\bkey\b/);
    expect(paragraph ?? '', 'licence').toMatch(/Apache License, Version 2\.0/);
  });
});
