import { describe, expect, it } from 'vitest';

import {
  MAP_PICTURE_SIZE,
  mapOrientationOf,
  mapPictureCover,
} from '../../../src/games/counting/logic/mapPictures';
import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import type { MapPoint } from '../../../src/games/counting/logic/progressMapLayout';
import {
  PROGRESS_MAP_BACKGROUNDS,
  progressMapStyleFor,
} from '../../../src/games/counting/logic/theme';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { pictureFileName } from './mapPictureHelpers';
import { pictureMapCases } from './mapPictureLayoutScenes';
import type { PictureMapCase } from './mapPictureLayoutScenes';
import { PICTURE_TONES, TONE_GRID } from './mapPictureTones';

/**
 * Testy kontrastu k #134 (převzato z kontroly #133): nenavštívená místa
 * a cesta mají vůči obrázku pod sebou kontrast aspoň 3 : 1, stejně jako
 * vůči zástupné barvě pozadí, když obrázek chybí (AC4).
 *
 * Obrázek pod místem je průměrná barva dílu mřížky 4 × 4, do kterého
 * střed místa (nebo bod cesty) padne po zakrytí okna (`mapPictureCover`).
 * Barvy jsou změřené předem (`mapPictureTones.ts`), Node WebP nepřečte;
 * test otisků v `mapPictureFiles.test.ts` hlídá, že patří k souborům.
 *
 * Navržené rozhraní `src/games/counting/logic/theme.ts`:
 * `progressMapStyleFor(theme: MapThemeId, look: MapLook): ProgressMapStyle`
 * barvy mapy podle tématu a vzhledu (`MapLook = 'picture' | 'placeholder'`
 * z `mapPictureLoading.ts`), aspoň `pathColor` (cesta) a
 * `placeBorderColor` (okraj místa, kam značka ještě nedošla), `#RRGGBB`.
 * Světlá mapa může mít tmavou cestu a tmavý vesmír světlou.
 *
 * Ručně se kontroluje: kontrast na skutečných místech obrázku (průměr dílu
 * mřížky skryje drobné detaily) a značka v 8 barvách profilu (AC6).
 */

const MIN_CONTRAST = 3;

/** Body cesty, na kterých se kontrast měří: místa a body na úsecích mezi nimi. */
const SEGMENT_SAMPLES = [0.25, 0.5, 0.75];

function pathPoints(places: readonly MapPoint[]): MapPoint[] {
  const points: MapPoint[] = [...places];
  for (let index = 0; index + 1 < places.length; index += 1) {
    const from = places[index];
    const to = places[index + 1];
    if (from && to) {
      for (const share of SEGMENT_SAMPLES) {
        points.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
      }
    }
  }
  return points;
}

/** Barva obrázku pod bodem mapy (herní jednotky) v daném okně. */
function toneUnder(testCase: PictureMapCase, point: MapPoint): string {
  const { window, area, theme } = testCase;
  const orientation = mapOrientationOf({ width: window.width, height: window.height });
  const picture = MAP_PICTURE_SIZE[orientation];
  const cover = mapPictureCover({ width: window.width, height: window.height }, picture);
  const cssX = area.offsetX + point.x * area.scale;
  const cssY = area.offsetY + point.y * area.scale;
  const cell = (value: number, start: number, size: number): number =>
    Math.min(TONE_GRID - 1, Math.max(0, Math.floor(((value - start) / size) * TONE_GRID)));
  const column = cell(cssX, cover.left, cover.width);
  const row = cell(cssY, cover.top, cover.height);
  const tones = PICTURE_TONES[pictureFileName(theme, orientation)]?.tones ?? [];
  return tones[row * TONE_GRID + column] ?? '#000000';
}

function describePoint(point: MapPoint): string {
  return `[${Math.round(point.x)}, ${Math.round(point.y)}]`;
}

describe('#134: cesta a nenavštívená místa jsou dobře vidět na obrázku i na zástupném pozadí', () => {
  it('okraj místa, kam značka ještě nedošla, má vůči obrázku pod ním kontrast aspoň 3 : 1', () => {
    for (const testCase of pictureMapCases()) {
      const { placeBorderColor } = progressMapStyleFor(testCase.theme, 'picture');
      // Start je na začátku každé mapy už navštívený, nenavštívené bývají zastávky a cíl.
      for (let step = 1; step <= MAP_STEPS; step += 1) {
        const place = testCase.layout.places[step];
        if (!place) {
          continue;
        }
        const tone = toneUnder(testCase, place);
        expect(
          contrastRatio(placeBorderColor, tone),
          `${testCase.label}, místo ${step}: ${placeBorderColor} na ${tone}`,
        ).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('cesta má vůči obrázku pod sebou kontrast aspoň 3 : 1 po celé délce', () => {
    for (const testCase of pictureMapCases()) {
      const { pathColor } = progressMapStyleFor(testCase.theme, 'picture');
      for (const point of pathPoints(testCase.layout.places)) {
        const tone = toneUnder(testCase, point);
        expect(
          contrastRatio(pathColor, tone),
          `${testCase.label}, cesta v ${describePoint(point)}: ${pathColor} na ${tone}`,
        ).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('bez obrázku má cesta i okraj místa vůči zástupné barvě mapy kontrast aspoň 3 : 1', () => {
    for (const testCase of pictureMapCases()) {
      const background = PROGRESS_MAP_BACKGROUNDS[testCase.theme];
      const style = progressMapStyleFor(testCase.theme, 'placeholder');
      expect(
        contrastRatio(style.pathColor, background),
        `${testCase.theme}: cesta ${style.pathColor} na ${background}`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(
        contrastRatio(style.placeBorderColor, background),
        `${testCase.theme}: okraj místa ${style.placeBorderColor} na ${background}`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('pomůcka najde pod levým horním rohem okna levý horní díl obrázku', () => {
    const [testCase] = pictureMapCases();
    expect(testCase).toBeDefined();
    if (!testCase) {
      return;
    }
    const corner = {
      x: -testCase.area.offsetX / testCase.area.scale,
      y: -testCase.area.offsetY / testCase.area.scale,
    };
    const orientation = mapOrientationOf({
      width: testCase.window.width,
      height: testCase.window.height,
    });
    const tones = PICTURE_TONES[pictureFileName(testCase.theme, orientation)]?.tones ?? [];
    expect(toneUnder(testCase, corner)).toBe(tones[0]);
  });
});
