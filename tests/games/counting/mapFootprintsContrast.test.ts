import { describe, expect, it } from 'vitest';

import { mapFootprintStyleFor } from '../../../src/shared/logic/mapFootprints';
import type { MapFootprintStyle } from '../../../src/shared/logic/mapFootprints';
import type { MapLook } from '../../../src/shared/logic/mapPictureLoading';
import { PROGRESS_MAP_BACKGROUNDS } from '../../../src/shared/logic/mapTheme';
import { MAP_THEMES } from '../../../src/shared/logic/progressMap';
import { describePoint, footprintCases, printContrast, toneUnder } from './mapFootprintHelpers';
import type { FootprintCase } from './mapFootprintHelpers';
import type { MapPoint } from '../../../src/shared/logic/progressMapLayout';

/**
 * Testy k #144 AC3: prošlé (zlaté s tmavým obrysem) a neprošlé (bílé
 * poloprůhledné) stopy jsou dobře vidět na obrázku mapy v kartě (#145)
 * i na zástupném pozadí bez obrázku, ve všech oknech mapy a na 5 mapách.
 *
 * Kontrast se měří jako v `mapPictureContrast.test.ts` (#134): pod
 * středem stopy je průměrná barva dílu mřížky 4 × 4 obrázku, který zakrývá
 * kartu (`mapCardPictureCover`, jako `mapPathArc.test.ts`); bez obrázku
 * zástupná barva pozadí mapy. Barva stopy se smíchá s pozadím podle
 * krytí stopy a počítá se výraznější z výplně a obrysu (prošlá stopa je
 * zlatá s tmavým obrysem: na světlém obrázku je vidět obrys, na tmavém
 * vesmíru výplň). Každá stopa se měří jako prošlá i jako neprošlá, protože
 * každá je na některém kroku prošlá a na jiném ne.
 *
 * Že jsou na nové mapě po cíli všechny stopy neprošlé, hlídá
 * `mapFootprints.test.ts` (AC4).
 *
 * Ručně se kontroluje: kontrast na skutečných místech obrázku (průměr dílu
 * mřížky skryje drobné detaily).
 */

const MIN_LIT_CONTRAST = 3;
const MIN_UNLIT_CONTRAST = 1.5;
const MIN_UNLIT_ALPHA = 0.35;
const MAX_UNLIT_ALPHA = 0.6;
const MIN_LIT_TO_UNLIT = 1.5;

const LOOKS: readonly MapLook[] = ['picture', 'placeholder'];

/** Pod čím stopa leží: obrázek pod středem, nebo zástupná barva mapy. */
function underPrint(testCase: FootprintCase, look: MapLook, point: MapPoint): string {
  return look === 'picture' ? toneUnder(testCase, point) : PROGRESS_MAP_BACKGROUNDS[testCase.theme];
}

/** Každá stopa každého případu s barvou pod ní a barvami stop. */
function measuredPrints(): Array<{
  where: string;
  under: string;
  style: MapFootprintStyle;
}> {
  return footprintCases().flatMap((testCase) =>
    LOOKS.flatMap((look) => {
      const style = mapFootprintStyleFor(testCase.theme, look);
      return testCase.footprints.prints.map((print, index) => {
        const under = underPrint(testCase, look, print);
        return {
          where: `${testCase.label}, ${look === 'picture' ? 'obrázek' : 'bez obrázku'}, stopa ${index + 1} v ${describePoint(print)} na ${under}`,
          under,
          style,
        };
      });
    }),
  );
}

describe('#144 AC3: prošlé i neprošlé stopy jsou vidět na obrázku i bez něj', () => {
  it('prošlá stopa má vůči obrázku i zástupnému pozadí kontrast aspoň 3 : 1', () => {
    for (const { where, under, style } of measuredPrints()) {
      expect(printContrast(style.lit, under), where).toBeGreaterThanOrEqual(MIN_LIT_CONTRAST);
    }
  });

  it('neprošlá stopa má krytí 35 až 60 % na každé mapě s obrázkem i bez něj', () => {
    for (const theme of MAP_THEMES) {
      for (const look of LOOKS) {
        const { alpha } = mapFootprintStyleFor(theme, look).unlit;
        const where = `${theme}, ${look}: krytí ${alpha}`;
        expect(alpha, where).toBeGreaterThanOrEqual(MIN_UNLIT_ALPHA);
        expect(alpha, where).toBeLessThanOrEqual(MAX_UNLIT_ALPHA);
      }
    }
  });

  it('neprošlá stopa má po smíchání s pozadím kontrast aspoň 1,5 : 1', () => {
    for (const { where, under, style } of measuredPrints()) {
      expect(printContrast(style.unlit, under), where).toBeGreaterThanOrEqual(MIN_UNLIT_CONTRAST);
    }
  });

  it('prošlá stopa je v každém měřeném bodě aspoň 1,5× kontrastnější než neprošlá', () => {
    for (const { where, under, style } of measuredPrints()) {
      const lit = printContrast(style.lit, under);
      const unlit = printContrast(style.unlit, under);
      expect(
        lit / unlit,
        `${where}: prošlá ${lit.toFixed(2)}, neprošlá ${unlit.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(MIN_LIT_TO_UNLIT);
    }
  });
});
