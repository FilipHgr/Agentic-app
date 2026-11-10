/**
 * Pevný stav úložiště Omalovánek uložený hrou před #100 (paleta 8 barev,
 * záznam obrázku ve formátu p2 z #93 a nedávné barvy z #99 v samostatném
 * záznamu). Je to celé úložiště hry jednoho profilu tak, jak ho stará
 * verze zapsala: klíče i hodnoty. Obrázek 120 × 80 je stejný obrys jako
 * v `legacyRecordFixture.ts` (svislá čára x 60, vodorovná čára y 50).
 *
 * Jak vznikl (jen pro představu, znovu se negeneruje): štětec hnědou,
 * fix oranžovou, pastelka žlutou (zrno pastelky), razítkový fix černou,
 * duha, guma přes část obrázku, nakonec výběr červené a fialové.
 * Vybraná je fialová (5), nedávné barvy jsou červená a černá (0, 7).
 *
 * Záznam ani očekávané pixely se nesmí přegenerovat: hlídají, že se
 * staré obrázky po rozšíření palety (#100) čtou beze změny.
 */

import { legacyRegions } from './legacyRecordFixture';

/** Obrys, ke kterému záznam patří (stejný jako u p1). */
export const legacyP2Regions = legacyRegions;

/** Vybraná barva uložená v záznamu (fialová). */
export const LEGACY_P2_SELECTED_COLOR = 5;

/** Nedávné barvy uložené vedle obrázku (červená, černá). */
export const LEGACY_P2_RECENT_COLORS: readonly (number | null)[] = [0, 7];

/** Záznam obrázku p2 po kouscích (znaky mimo ASCII jako `\u` kvůli čitelnosti). */
export const LEGACY_P2_RECORD = [
  'p2|house|1|120|80|5|',
  '\u13d4\u5da2\u7183\u123f\u1880\u61da\u3846\u123c\u8c9a\u239d\u1d89\u6f2e',
  '\u2b26\u8d5a\u2845\u8934\u3779\u7784\u4134\u36be\u284b\u8834\u404d\u2e35',
  '\u7ce8\u7614\u4999\u6934\u89db\u6184\u2f83\u426b\u82a3\u335e\u3c8d\u2e0d',
  '\u59ee\u5610\u6e0d\u59b7\u5edd\u1c20\u8c9a\u237f\u2db8\u3178\u2a26\u557e',
  '\u2b74\u47f3\u61a3\u126f\u83b7\u3308\u1f06\u74c3\u61db\u67cb\u4d6f\u1364',
  '\u83e3\u4746\u2ff8\u2b25\u74a6\u7e84\u3dec\u4c9a\u23af\u2c24\u596a\u3db2',
  '\u7346\u2ef9\u2a27\u4f3b\u4a31\u87c1\u613c\u89d3\u678f\u4e0d\u1c13\u779d',
  '\u5c7b\u804a\u8db5\u3c21\u4c1a\u2827\u6f38\u30f8\u2b24\u651e\u2da5\u5c20',
  '\u8c1b\u23ef\u8d18\u61d8\u8836\u323e\u2cf9\u2a22\u2f46\u2cf8\u2a24\u359d',
  '\u4753\u4346\u2c78\u2a30\u320f\u56dc\u48f0\u465e\u847a\u2ebe\u7e8c\u47f0',
  '\u4644\u1f9d\u6d18\u7de0\u7cb8\u5a7e\u36f6\u81b7\u51b2\u20fc\u46e3\u4793',
  '\u32da\u3df3\u6bf3\u579e\u1688\u54f3\u63ca\u2d8f\u1346\u14af\u7147\u4dca',
  '\u8d8f\u123e\u8c1a\u282a\u8ca8\u3854\u60a1\u3152\u52a5\u150a\u8ca8\u70c1',
  '\u5183\u1306\u160c\u1c18\u2830\u4060\u70c1\u5183\u1306\u160c\u1c1c\u2830',
  '\u4060\u70c1\u5183\u1306\u1608\u343b\u3f1c\u69c8\u6e3c\u4c78\u824e\u1214',
  '\u1810\u13d0\u6880\u2f84\u10ed\u8038\u300e\u6f23\u560c\u19c7\u5710\u6e45',
  '\u5598\u235f\u3e21\u8c8f\u2826\u4f1e\u4efc\u89ff\u578f\u850a\u18c3\u7bdf',
  '\u579f\u1e20\u4c74\u1a11\u4bff\u67de\u4e32\u4aa1\u174f\u35ce\u1e19\u57f7',
  '\u578f\u1e20\u4caf\u4866\u7f1f\u8e39\u7fca\u8b86\u45f3\u89eb\u5f3c\u6c3e',
  '\u4891\u169f\u4e7e\u89c7\u63c7\u3910\u7feb\u7fc7\u5f8e\u49f2\u8f22\u1d7f',
  '\u8d7d\u86b9\u1bcb\u8c8a\u20bc\u4cf3\u47a9\u7b16\u24e3\u8f9d\u8cca\u5cb1',
  '\u3237\u5734\u899f\u414f\u2e7e\u4d73\u3fab\u6102\u1201\u7fef\u5f57\u5abc',
  '\u7f88\u13ef\u1f3d\u4f2a\u89b0\u2c20\u1f3a\u5306\u160c\u1c18\u2830\u2020',
  '\u3040\u5081\u1112\u2224\u3c58\u68b1\u4122\u3244\u5489\u1912\u1e1c\u2c38',
  '\u4870\u80e1\u3142\u5285\u150a\u134c\u188c\u36e6\u1204\u1408\u1a21\u4bf0',
  '\u37de\u1000',
  '|b718fb67',
].join('');

/** Celé úložiště hry profilu po staré verzi jako dvojice klíč a hodnota. */
export const LEGACY_P2_STORAGE: ReadonlyArray<readonly [string, string]> = [
  ['recentColors.house', '0,7'],
  ['toolPanel.seen', '1'],
  ['picture.house', LEGACY_P2_RECORD],
];

/**
 * Barvy všech pixelů po řádcích jako úseky „hodnota a počet“ (stejný zápis
 * jako v `legacyRecordFixture.ts`): „-490“ je 490 pixelů bez barvy, „21“
 * jeden pixel barvy 2.
 */
const LEGACY_P2_PIXEL_RUNS = [
  '-490 21 -19 21 -38 13 -58 21 -19 21 -38 14 -56 21 -19 22 -38 15 -55 21 -19 22 -40',
  '14 -49 62 -3 22 -18 21 -41 15 -47 65 -1 22 -18 21 -43 14 -46 66 22 -19 21 -43 14',
  '-46 65 22 -19 21 -44 15 -45 65 21 62 -16 21 -46 15 -46 63 21 64 -14 21 -47 15 -47',
  '21 66 -13 22 -47 15 -46 21 68 -11 22 -48 15 -45 21 -2 68 -9 22 -50 14 -44 21 -4 67',
  '-8 22 -51 14 -43 22 -4 68 -6 21 -53 15 -41 22 -6 68 -4 21 -54 15 -41 21 -8 67 -4 21',
  '-54 15 -40 21 -9 68 -2 21 -55 15 -38 21 -12 67 22 -57 14 -37 21 -14 65 22 -57 15',
  '-36 22 -14 64 21 63 -57 14 -35 22 -16 62 21 65 -56 14 -34 22 -18 61 21 65 -56 15',
  '-32 22 -19 21 66 -56 14 -33 21 -18 21 -2 65 -57 15 -31 21 -18 21 -4 63 -58 15 -29',
  '21 -19 22 -4 62 -59 15 -28 21 -19 22 -12 62 -52 15 -27 21 -19 22 -12 63 -53 14 -26',
  '21 -19 22 -12 65 -52 14 -25 22 -18 21 -13 67 -51 15 -23 22 -18 21 -14 67 -51 15 -23',
  '21 -19 21 -14 68 -50 15 -22 21 -19 21 -16 68 -49 15 -20 21 -19 22 -18 67 -49 15 -19',
  '21 -19 22 -19 67 -50 14 -18 22 -18 21 -22 65 -51 14 -17 22 -18 21 -24 62 -53 15 -15',
  '22 -19 21 -79 14 -15 22 -19 21 -80 15 -14 24 -2 24 -2 22 -2 24 -39 147 -14 24 -2 24',
  '-2 22 -2 24 -39 147 -908 03 -116 06 -114 08 -113 09 -113 07 13 -48 72 -62 04 16 -45',
  '74 -63 02 18 -44 72 -6 71 -60 17 23 -40 74 -3 75 -60 15 25 -46 73 -6 71 -56 12 28',
  '-44 73 -6 71 -59 27 33 -48 74 -60 25 35 -47 73 -5 72 -55 23 37 -47 71 -4 74 -56 39',
  '42 -50 72 -6 71 -53 35 45 -47 74 -3 75 -53 33 47 -53 73 -6 71 -49 31 48 51 -51 73',
  '-4 74 -51 46 54 -56 73 -53 43 57 -54 73 -5 72 -48 41 59 -54 71 -4 74 -50 56 04 -57',
  '72 -53 54 06 -54 71 -2 71 -54 51 09 -67 18 08 58 48 38 27 06 12 -64 19 08 58 48 38',
  '28 18 -63 19 08 58 48 38 28 18 -64 18 08 58 48 38 28 17 -1',
].join(' ');

/** Očekávané barvy pixelů po řádcích (`null` bez barvy a na obrysu). */
export function legacyP2Pixels(): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (const run of LEGACY_P2_PIXEL_RUNS.split(' ')) {
    const color = run.startsWith('-') ? null : Number(run.charAt(0));
    const count = Number(run.slice(1));
    for (let step = 0; step < count; step += 1) {
      pixels.push(color);
    }
  }
  return pixels;
}
