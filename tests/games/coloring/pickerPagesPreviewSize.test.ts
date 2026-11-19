import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import { layoutPicker } from '../../../src/games/coloring/logic/pickerLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { viewportOf } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS } from './coloringLayoutScenes';
import { PICKER_BEFORE_150 } from './layoutBefore150Fixture';

/**
 * Test k #150, upřesnění 4: náhledy mají i se šipkami stejnou velikost
 * jako dnes. Pravidlo v cyklu pro všechna okna Omalovánek a testovací sady
 * s 13 a 25 omalovánkami (AC3): šířka náhledu je stejná jako v pevné
 * tabulce před #150.
 *
 * Výjimkou je 5 velikostí telefonu na výšku, kde mřížka 2 × 6 vyplní celou
 * výšku a v řadě domečku je mezi domečkem a ukazatelem klíčů místo nejvýš
 * na jednu šipku. Šipky se tam nevejdou ani s posunutým ukazatelem klíčů,
 * proto se náhledy zmenší, aby se šipky vešly pod mřížku. Očekávaná šířka
 * je tu opsaná (±1 px) a náhled má i tak aspoň 64 px.
 */

const PAGED_COUNTS: readonly number[] = [13, 25];

/** Okna (podle rozměru), kde jsou náhledy se šipkami menší, a jejich šířka v CSS px. */
const SMALLER_PREVIEW_WIDTHS: ReadonlyMap<string, number> = new Map([
  ['390×844', 114],
  ['393×852', 115],
  ['430×932', 130.4],
  ['360×780', 117.3],
  ['375×667', 109],
]);

function sizeOf(window: TestWindow): string {
  return `${window.width}×${window.height}`;
}

function widthBefore150(window: TestWindow): number {
  const place = PICKER_BEFORE_150.find((row) => row.window === window.name)?.places[0];
  if (place === undefined) {
    throw new Error(`${window.name}: chybí rozložení výběru před #150`);
  }
  return place[2] - place[0];
}

describe('#150 upřesnění 4: náhledy se šipkami mají stejnou velikost jako dnes', () => {
  it('šířka náhledu se šipkami je jako před #150, jen v 5 oknech telefonu na výšku menší a aspoň 64 px', () => {
    for (const window of COLORING_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
      for (const pictureCount of PAGED_COUNTS) {
        const layout = layoutPicker(area, { pictureCount });
        const what = `${window.name}, ${pictureCount} omalovánek`;
        const widths = layout.previews.map((rect) => rect.width * area.scale);
        const smaller = SMALLER_PREVIEW_WIDTHS.get(sizeOf(window));
        for (const width of widths) {
          if (smaller === undefined) {
            expect(width, `${what}: stejná šířka jako před #150`).toBeCloseTo(
              widthBefore150(window),
              2,
            );
          } else {
            expect(
              Math.abs(width - smaller),
              `${what}: šířka asi ${smaller} px`,
            ).toBeLessThanOrEqual(1);
            expect(width, `${what}: aspoň 64 px`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
          }
        }
      }
    }
  });
});
