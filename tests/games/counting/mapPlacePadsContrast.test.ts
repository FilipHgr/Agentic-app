import { describe, expect, it } from 'vitest';

import { mapPlacePadStyleFor } from '../../../src/games/counting/logic/mapPlacePads';
import type { MapPlacePad } from '../../../src/games/counting/logic/mapPlacePads';
import type { MapLook } from '../../../src/games/counting/logic/mapPictureLoading';
import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import type { MapPoint } from '../../../src/games/counting/logic/progressMapLayout';
import {
  PROGRESS_MAP_BACKGROUNDS,
  PROGRESS_MAP_STYLE,
  progressMapStyleFor,
} from '../../../src/games/counting/logic/theme';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { describePoint, toneUnder } from './mapFootprintHelpers';
import { padCases, padName, padsWithStep } from './mapPlacePadHelpers';

/**
 * Testy k #147 AC5: podložky míst jsou dobře vidět na obrázku mapy
 * v kartě (#145) i na zástupném pozadí bez obrázku a kruh místa je dobře
 * vidět na podložce, rozsvícený i zhasnutý, na všech 5 mapách.
 *
 * Kontrast se měří jako v `mapPictureContrast.test.ts` (#134): pod bodem
 * je průměrná barva dílu mřížky 4 × 4 obrázku, který zakrývá kartu
 * (`toneUnder` z `mapFootprintHelpers.ts`, jako u stop #144); bez obrázku
 * zástupná barva pozadí mapy. Okraj podložky leží kolem celé podložky,
 * proto se obrázek bere pod jejím středem a pod středy jejích 4 stran.
 *
 * Kruh místa: zhasnuté místo má okraj `placeBorderColor` (cíl
 * `goalBorderColor`) z `progressMapStyleFor`, rozsvícené místo výplň
 * `PROGRESS_MAP_STYLE.visitedColor`, zhasnuté výplň
 * `PROGRESS_MAP_STYLE.placeColor` (AC4: rozsvícení beze změny). Start je
 * na každé mapě od začátku rozsvícený, zhasnuté bývají zastávky a cíl.
 *
 * Ručně se kontroluje: kontrast na skutečných místech obrázku (průměr dílu
 * mřížky skryje drobné detaily) a že podložka splývá s krajinou (AC7).
 */

const MIN_CONTRAST = 3;
const MIN_LIT_TO_UNLIT = 1.5;

const LOOKS: readonly MapLook[] = ['picture', 'placeholder'];

function lookName(look: MapLook): string {
  return look === 'picture' ? 'obrázek' : 'bez obrázku';
}

/** Střed podložky a středy jejích 4 stran, kudy vede její okraj. */
function outlinePoints(pad: MapPlacePad): MapPoint[] {
  return [
    { x: pad.x, y: pad.y },
    { x: pad.x - pad.width / 2, y: pad.y },
    { x: pad.x + pad.width / 2, y: pad.y },
    { x: pad.x, y: pad.y - pad.height / 2 },
    { x: pad.x, y: pad.y + pad.height / 2 },
  ];
}

/** Okraj zhasnutého místa podle kroku (cíl má vlastní zelený okraj). */
function unlitBorderColor(theme: MapThemeId, look: MapLook, step: number): string {
  const style = progressMapStyleFor(theme, look);
  return step === MAP_STEPS ? style.goalBorderColor : style.placeBorderColor;
}

describe('#147 AC5: podložky jsou dobře vidět a kruh místa je dobře vidět na podložce', () => {
  it('okraj podložky má vůči obrázku pod ní kontrast aspoň 3 : 1', () => {
    for (const testCase of padCases()) {
      const { outlineColor } = mapPlacePadStyleFor(testCase.theme, 'picture');
      for (const { pad, step } of padsWithStep(testCase)) {
        for (const point of outlinePoints(pad)) {
          const tone = toneUnder(testCase, point);
          expect(
            contrastRatio(outlineColor, tone),
            `${testCase.label}, ${padName(step)} v ${describePoint(point)}: ${outlineColor} na ${tone}`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });

  it('bez obrázku má okraj podložky vůči zástupné barvě mapy kontrast aspoň 3 : 1', () => {
    for (const theme of MAP_THEMES) {
      const background = PROGRESS_MAP_BACKGROUNDS[theme];
      const { outlineColor } = mapPlacePadStyleFor(theme, 'placeholder');
      expect(
        contrastRatio(outlineColor, background),
        `${theme}: okraj podložky ${outlineColor} na ${background}`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('okraj zhasnutého místa má vůči podložce kontrast aspoň 3 : 1, s obrázkem i bez něj', () => {
    for (const theme of MAP_THEMES) {
      for (const look of LOOKS) {
        const { fillColor } = mapPlacePadStyleFor(theme, look);
        for (let step = 1; step <= MAP_STEPS; step += 1) {
          const border = unlitBorderColor(theme, look, step);
          expect(
            contrastRatio(border, fillColor),
            `${theme}, ${lookName(look)}, ${padName(step)}: okraj ${border} na ${fillColor}`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });

  it('výplň rozsvíceného místa má vůči podložce kontrast aspoň 3 : 1, s obrázkem i bez něj', () => {
    const lit = PROGRESS_MAP_STYLE.visitedColor;
    for (const theme of MAP_THEMES) {
      for (const look of LOOKS) {
        const { fillColor } = mapPlacePadStyleFor(theme, look);
        expect(
          contrastRatio(lit, fillColor),
          `${theme}, ${lookName(look)}: rozsvícené místo ${lit} na ${fillColor}`,
        ).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('rozsvícené a zhasnuté místo se od sebe liší kontrastem aspoň 1,5 : 1', () => {
    const lit = PROGRESS_MAP_STYLE.visitedColor;
    const unlit = PROGRESS_MAP_STYLE.placeColor;
    expect(contrastRatio(lit, unlit), `${lit} a ${unlit}`).toBeGreaterThanOrEqual(MIN_LIT_TO_UNLIT);
  });
});
