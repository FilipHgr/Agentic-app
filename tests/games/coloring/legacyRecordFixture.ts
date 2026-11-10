/**
 * Pevný záznam Omalovánek ve formátu p1 z #92, uložený hrou před #93
 * (kódování s předpovědí jen z pixelu nad). Obrázek 120 × 80 se svislou
 * čarou x 60 a vodorovnou čarou y 50 a pěti tahy štětce v různých
 * barvách, vybraná barva 3. Záznam ani očekávané pixely se nesmí
 * přegenerovat: hlídají, že se staré záznamy čtou beze změny.
 */

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { drawing } from './outlineFixtures';

/** Obrys, ke kterému záznam patří. */
export function legacyRegions(): RegionMap {
  return drawing(120, 80).verticalLine(60).horizontalLine(50).regions();
}

/** Vybraná barva uložená v záznamu. */
export const LEGACY_SELECTED_COLOR = 3;

/** Záznam p1 po kouscích (znaky mimo ASCII jako `\u` kvůli čitelnosti). */
export const LEGACY_P1_RECORD = [
  'p1|house|1|1',
  '20|80|3|\u1bf6\u247b\u6aa1\u6df1',
  '\u73df\u671f\u6e38\u88fb\u73c7\u7f38\u5891\u122f\u7f36\u5b91\u1227\u7f3b',
  '\u5891\u1217\u7f34\u8424\u3083\u8bcd\u2e3a\u1912\u20ff\u879a\u8c74\u4221',
  '\u8bc7\u778e\u45f1\u81d0\u5891\u17bf\u4cdf\u73a3\u210f\u2f79\u73c7\u5742',
  '\u3244\u2d7d\u83af\u1e8c\u5439\u8de7\u4f1e\u2d09\u1910\u7ff7\u5f7c\u4a32',
  '\u20db\u544f\u1f1d\u1489\u1869\u7237\u5746\u3219\u8c71\u1de3\u73a1\u2122',
  '\u1cbe\u8885\u81d1\u5886\u2fbc\u31f8\u88e8\u3448\u535e\u217c\u4a32\u20d3',
  '\u546f\u1f1d\u1489\u1865\u7247\u5746\u3218\u8893\u81e3\u6091\u155f\u4c4b',
  '\u88e8\u3157\u57cf\u1e25\u8c78\u832f\u6e26\u8c7b\u82df\u6e27\u4c78\u82ff',
  '\u6e3c\u4ef1\u81f7\u578f\u6e3c\u4ef1\u81e3\u83c7\u1f1f\u4c78\u8de3\u73ef',
  '\u1f1f\u4c78\u8de3\u73ef\u1f1f\u4c78\u88e3\u8bd7\u1f7e\u2c11\u4881\u1102',
  '\u1204\u1403\u4f8f\u1f1c\u31f8\u8e10\u13b7\u57e1\u103b\u4c7e\u1803\u6bc7',
  '\u8080\u2dbc\u4f08\u11db\u73f0\u501d\u6fc0\u8210\u2020\u1761\u1102\u113e',
  '\u2a84\u1408\u153c\u4c71\u5e20\u3040\u39e3\u73c7\u1cc2\u1204\u129e\u2e3c',
  '\u48cc\u2020\u3029\u81e3\u738c\u7102\u1202\u5f1e\u2e38\u7610\u2020\u24f1',
  '\u81e3\u5671\u1101\u378f\u1f1c\u64a1\u3142\u5285\u150a\u1a14\u2428\u3850',
  '\u60a1\u3142\u5285\u150a\u1a14\u2428\u3850\u60a1\u3142\u5285\u150a\u1a14',
  '\u2428\u3850\u60a1\u3142\u5285\u150a\u1a12\u209f\u578f\u1e5a\u57e9\u578f',
  '\u1f1c\u497b\u88f1\u81cd\u4cff\u61f1\u81ce\u6e3c\u4c78\u88f1\u81e3\u73c7',
  '\u578f\u1f1e\u2e3c\u4c78\u88f1\u81e3\u73c7\u578f\u1f1e\u2e3c\u4c78\u88f1',
  '\u81e3\u73c7\u578f\u1f1e\u2e3c\u4c78\u88f1\u81e3\u7381\u60c0|b',
  '74f956a',
].join('');

/**
 * Barvy všech pixelů po řádcích jako úseky „hodnota a počet“: číslo je
 * index barvy (jedna číslice), „-“ bez barvy (i obrys): „-130“ je 130
 * pixelů bez barvy, „412“ 12 pixelů barvy 4.
 */
const LEGACY_PIXEL_RUNS = [
  '-89 52 -117 54 -116 54 -97 72 -17 54 -96 74 -16 54 -96 76 -14 54 -97 76 -13 54',
  '-98 76 -12 54 -32 43 -64 76 -11 54 -31 46 -63 76 -10 54 -31 49 -61 76 -9 54 -32',
  '410 -60 76 -8 54 -34 411 -58 76 -7 54 -36 411 -58 76 -5 54 -39 411 -56 76 -4 54',
  '-41 411 -55 76 -3 54 -44 411 -53 76 -2 54 -46 411 -52 76 -1 54 -49 411 -50 76 54',
  '-51 411 -49 75 54 -54 411 -47 74 54 -56 411 -47 72 54 -59 411 -45 71 54 71 -60',
  '411 -44 54 72 -62 411 -41 54 73 -63 411 -39 54 74 -65 411 -36 54 75 -66 411 -34',
  '54 76 -68 410 -32 54 -1 76 -69 49 -31 54 -3 76 -70 46 -31 54 -4 76 -71 43 -32 54',
  '-5 76 -105 54 -6 76 -104 54 -7 76 -103 54 -8 76 -102 54 -9 76 -101 54 -10 76',
  '-100 54 -12 76 -98 54 -13 76 -97 54 -14 76 -96 54 -15 76 -95 54 -16 76 -94 54',
  '-17 76 -93 54 -18 76 -92 54 -19 76 -91 54 -21 74 -91 54 -22 72 -92 54 -116 54',
  '-116 54 -299 08 -114 08 -114 08 -114 08 -114 08 -114 08 -114 08 -113 08 -108 012',
  '-104 015 -101 016 -100 016 -100 016 -100 016 -100 016 -100 016 -101 015 -40 255',
  '-9 012 -43 257 -8 08 -47 257 -9 03 -52 255 -961',
].join(' ');

/** Očekávané barvy pixelů po řádcích (`null` bez barvy a na obrysu). */
export function legacyPixels(): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (const run of LEGACY_PIXEL_RUNS.split(' ')) {
    const color = run.startsWith('-') ? null : Number(run.charAt(0));
    const count = Number(run.slice(1));
    for (let step = 0; step < count; step += 1) {
      pixels.push(color);
    }
  }
  return pixels;
}
