/**
 * Pevný stav úložiště Omalovánek uložený hrou před #101 (paleta 12 barev,
 * záznam obrázku ve formátu p3 z #100, nedávné barvy z #99 a velikost čáry
 * z #91 v samostatných záznamech). Je to celé úložiště hry jednoho profilu
 * tak, jak ho verze před puntíkovým fixem zapsala: klíče i hodnoty.
 * Obrázek 120 × 80 je stejný obrys jako v `legacyRecordFixture.ts`
 * (svislá čára x 60, vodorovná čára y 50).
 *
 * Jak vznikl (jen pro představu, znovu se negeneruje): štětec růžovou,
 * fix tělovou, pastelka šedou malou velikostí (zrno pastelky), razítkový
 * fix světle modrou, duha, štětec žlutou, guma přes část obrázku, nakonec
 * výběr černé a šedé. Vybraná je šedá (10), nedávné barvy jsou černá
 * a žlutá (7, 2), velikost malá.
 *
 * Záznam ani očekávané pixely se nesmí přegenerovat: hlídají, že se
 * obrázky uložené před #101 čtou beze změny i po případném zlepšení
 * kódování.
 */

import { legacyRegions } from './legacyRecordFixture';

/** Obrys, ke kterému záznam patří (stejný jako u p1 a p2). */
export const legacyP3Regions = legacyRegions;

/** Vybraná barva uložená v záznamu (šedá). */
export const LEGACY_P3_SELECTED_COLOR = 10;

/** Nedávné barvy uložené vedle obrázku (černá, žlutá). */
export const LEGACY_P3_RECENT_COLORS: readonly (number | null)[] = [7, 2];

/** Velikost čáry uložená vedle obrázku. */
export const LEGACY_P3_LINE_SIZE = 'small';

/** Záznam obrázku p3 po kouscích (znaky mimo ASCII jako `\u` kvůli čitelnosti). */
export const LEGACY_P3_RECORD = [
  'p3|house|1|120|80|10|',
  '\u12dd\u1881\u8715\u1881\u8d03\u72e2\u2911\u11de\u811b\u11de\u8319\u11e2',
  '\u8119\u1885\u5504\u3c98\u5c48\u50b8\u56c1\u8a62\u4127\u7b98\u7444\u1e6e',
  '\u2393\u193e\u6c46\u70e6\u8339\u2893\u7dcc\u4222\u1737\u29c9\u54c4\u5f2e',
  '\u21b0\u4ab9\u5ecc\u34ee\u8319\u13bb\u64e4\u724e\u8711\u5888\u2e5c\u7726',
  '\u2275\u488d\u51ed\u7672\u4131\u238b\u1913\u5989\u1ef7\u29c9\u548e\u8b99',
  '\u74c4\u577b\u5ce4\u724e\u2111\u1282\u5444\u141b\u5ce4\u7262\u36b7\u18c8',
  '\u5408\u2ba9\u74c4\u5d2e\u15b0\u20ee\u4393\u193a\u5440\u53b9\u5e4c\u3624',
  '\u7571\u1d81\u1973\u2d98\u598d\u7632\u2102\u22ea\u4931\u231b\u546c\u146b',
  '\u5ce4\u724c\u2731\u5811\u8733\u5931\u6c46\u3220\u33dd\u34d2\u811b\u1126',
  '\u7416\u82e6\u2911\u11de\u811b\u11de\u8319\u1881\u7f71\u1d81\u7f73\u1c81',
  '\u8171\u1c88\u50ef\u488d\u50ef\u498c\u5684\u1202\u1101\u1080\u500d\u4b88',
  '\u4210\u2818\u1c0c\u1606\u1303\u1282\u1c37\u289b\u320b\u1a0a\u1505\u1282',
  '\u51c1\u70e0\u8062\u72de\u1ac7\u1383\u5242\u3121\u2090\u5841\u5b68\u5d64',
  '\u52c2\u7161\u40b0\u6858\u3c04\u1064\u6a48\u6820\u2010\u11ae\u78dc\u24b6',
  '\u8162\u6ae6\u8171\u429b\u108b\u6bcb\u4579\u4156\u8171\u48b9\u6c5c\u3eae',
  '\u4757\u2bab\u55c5\u76e2\u8171\u49b8\u6c5d\u3e6e\u6737\u3b8b\u55af\u38a8',
  '\u61ed\u72e6\u8577\u48b8\u6ddc\u3eae\u4757\u2bab\u6dcd\u7ae6\u896b\u7e6a',
  '\u247b\u431b\u55c5\u6aba\u6040\u3a2a\u243e\u7a2a\u2514\u2eae\u6515\u1a1e',
  '\u8755\u1a8a\u558f\u3b9a\u550f\u5baa\u1405\u32a2\u53fd\u3287\u7d45\u3287',
  '\u6dd5\u32a2\u53ed\u3287\u75d5\u196c\u3fdb\u3b02\u1980',
  '|524b32eb',
].join('');

/** Celé úložiště hry profilu po verzi před #101 jako dvojice klíč a hodnota. */
export const LEGACY_P3_STORAGE: ReadonlyArray<readonly [string, string]> = [
  ['recentColors.house', '7,2'],
  ['toolPanel.seen', '1'],
  ['picture.house', LEGACY_P3_RECORD],
  ['lineSize', 'small'],
];

/**
 * Barvy všech pixelů po řádcích jako úseky „hodnota a počet“: „-364“ je
 * 364 pixelů bez barvy, „82“ dva pixely barvy 8. Barva je jeden znak
 * v soustavě o základu 36 (0–9, a = 10, b = 11), zbytek je počet.
 */
const LEGACY_P3_PIXEL_RUNS = [
  '-364 82 -117 85 -115 86 -115 87 -114 87 -115 86 -115 87 -14 22 -38 93 -57 87 -13 22',
  '-38 96 -56 87 -11 22 -39 97 -55 87 -10 22 -41 97 -55 87 -8 22 -43 98 -53 87 -7 22',
  '-45 98 -53 86 -6 22 -48 97 -52 87 -4 22 -50 97 -51 87 -3 22 -52 98 -115 97 -115 97',
  '-115 97 -115 97 -48 82 22 82 -61 98 -46 81 22 84 -62 97 -45 22 85 -63 97 -43 22 87',
  '-63 98 -40 22 -1 87 -64 98 -38 22 -3 87 -65 97 -36 22 -4 87 -66 97 -34 22 -6 86 -67',
  '96 -33 22 -7 87 -68 93 -33 22 -8 87 -103 22 -10 87 -101 22 -11 87 -100 22 -13 87 -98',
  '22 -14 87 -97 22 -16 86 -96 22 -17 87 -94 22 -18 87 -93 22 -20 86 -7 08 -77 22 -21',
  '85 -7 09 18 22 -66 22 -23 82 -12 05 18 28 35 -55 22 -48 12 28 38 47 -45 22 -58 38 48',
  '58 02 -34 22 -69 45 58 06 -30 22 -80 52 06 -1520 b1 -4 b1 -18 b1 -4 b1 -79 b4 -1 b3',
  '-2 b3 -2 b3 -2 b3 -1 b4 -1 b3 -2 b3 -2 b3 -2 b3 -15 a3 -56 b2 -3 b2 -3 b1 -4 b1 -3',
  'b2 -3 b2 -3 b2 -3 b1 -4 b1 -3 b2 -18 a2 -121 a1 -122 a3 -119 a4 -119 a3 -120 a3 -119',
  'a2 -121 a1 -122 a3 -121 a2 -119 a3 -120 a3 -119 a2 -121 a1 -672',
].join(' ');

/** Očekávané barvy pixelů po řádcích (`null` bez barvy a na obrysu). */
export function legacyP3Pixels(): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (const run of LEGACY_P3_PIXEL_RUNS.split(' ')) {
    const color = run.startsWith('-') ? null : Number.parseInt(run.charAt(0), 36);
    const count = Number(run.slice(1));
    for (let step = 0; step < count; step += 1) {
      pixels.push(color);
    }
  }
  return pixels;
}
