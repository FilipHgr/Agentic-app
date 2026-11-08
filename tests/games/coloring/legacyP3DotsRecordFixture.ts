/**
 * Pevný stav úložiště Omalovánek uložený hrou před #102 (po puntíkovém
 * fixu z #101): záznam obrázku ve formátu p3 z #100, nedávné barvy z #99
 * a velikost čáry z #91 v samostatných záznamech. Je to celé úložiště hry
 * jednoho profilu tak, jak ho verze před proužkovým fixem zapsala: klíče
 * i hodnoty. Obrázek 300 × 200 je obrys `twoHalves()` ze
 * `savedPictureHelpers.ts` (svislá čára x 150 a 151).
 *
 * Proti `legacyP3RecordFixture.ts` má obrázek husté vzorky, které starší
 * záznamy neměly: puntíky (#101) přes štětec i na prázdném místě
 * a razítkové hvězdičky (#98). Hlídá, že je přečte i případné pozdější
 * zlepšené kódování.
 *
 * Jak vznikl (jen pro představu, znovu se negeneruje): štětec tělovou,
 * velkou velikostí puntíky modrou přes ni a růžovou v oblasti B, střední
 * velikostí razítkový fix světle modrou, ťuknutí puntíky černou, pastelka
 * oranžovou, nakonec výběr žluté a hnědé. Vybraná je barva 6, nedávné
 * barvy jsou žlutá a oranžová (2, 1), velikost střední.
 *
 * Záznam ani očekávané pixely se nesmí přegenerovat: hlídají, že se
 * obrázky uložené před #102 čtou beze změny i po případném zlepšení
 * kódování.
 */

import { twoHalves } from './savedPictureHelpers';

/** Obrys, ke kterému záznam patří. */
export const legacyP3DotsRegions = twoHalves;

/** Vybraná barva uložená v záznamu. */
export const LEGACY_P3_DOTS_SELECTED_COLOR = 6;

/** Nedávné barvy uložené vedle obrázku (žlutá, oranžová). */
export const LEGACY_P3_DOTS_RECENT_COLORS: readonly (number | null)[] = [2, 1];

/** Velikost čáry uložená vedle obrázku. */
export const LEGACY_P3_DOTS_LINE_SIZE = 'medium';

/** Záznam obrázku p3 s puntíky po kouscích (znaky mimo ASCII jako `\u` kvůli čitelnosti). */
export const LEGACY_P3_DOTS_RECORD = [
  'p3|house|1|300|200|6|',
  '\u102e\u7248\u3424\u2290\u1942\u3ae1\u2374\u584b\u3425\u6011\u8582\u4048',
  '\u35a4\u22d2\u1969\u14b4\u525a\u312d\u2096\u584b\u3021\u1484\u5a4a\u3925',
  '\u2492\u5a49\u3524\u6292\u3949\u24a4\u5a4a\u3125\u2090\u5849\u3420\u4f11',
  '\u24e4\u8272\u4939\u2c9c\u5e4d\u2212\u2309\u1484\u5244\u7121\u2131\u2898',
  '\u5c4c\u3626\u2313\u1989\u54c4\u7262\u4131\u2898\u5c4c\u3626\u2313\u1989',
  '\u54c4\u7262\u4131\u2898\u5c4c\u3626\u2313\u1989\u54c4\u7262\u4131\u20c3',
  '\u6d24\u7226\u2151\u28a8\u5c54\u362a\u2315\u198a\u54c5\u3262\u6131\u3898',
  '\u644c\u3a26\u2296\u5843\u1cc4\u5312\u8335\u188b\u5445\u7222\u8111\u4888',
  '\u6c44\u3e22\u2711\u1b88\u55c4\u32e2\u2171\u18b8\u5407\u3d2d\u2096\u584b',
  '\u3425\u6212\u7909\u4484\u6a42\u3d21\u2690\u5b48\u35a4\u22d2\u1969\u14b4',
  '\u525a\u312d\u2096\u584b\u3423\u890c\u124a\u3925\u2492\u5a49\u3524\u6292',
  '\u3949\u24a4\u5a52\u3529\u2294\u594a\u34a5\u2252\u5929\u3494\u624a\u3925',
  '\u2492\u5a49\u3424\u2212\u3909\u1484\u1266\u5848\u3424\u6212\u1908\u1c3b',
  '\u624c\u362a\u2315\u198a\u54c5\u3262\u6131\u3898\u644c\u3a26\u2513\u1a89',
  '\u5544\u72a2\u4151\u28a8\u5c54\u362a\u2315\u198a\u54c5\u3262\u6131\u38a4',
  '\u15fd\u866a\u2117\u188b\u5445\u7222\u8111\u4888\u6c44\u3e22\u2711\u1b88',
  '\u55c4\u32e2\u2171\u18b8\u545c\u322e\u2117\u188b\u5445\u7222\u8111\u4888',
  '\u6d86\u1d21\u2134\u584b\u3425\u6212\u7909\u4484\u6a42\u3d21\u2690\u5b48',
  '\u35a4\u22d2\u1969\u14b4\u525a\u312d\u2096\u584b\u3425\u6212\u7909\u4484',
  '\u6a42\u3d21\u117e\u594a\u345c\u2212\u3929\u3494\u624a\u3925\u2492\u5a49',
  '\u3524\u6292\u3949\u24a4\u5a52\u3529\u2294\u594a\u34a5\u2252\u5929\u3494',
  '\u624a\u3925\u2492\u5a48\u6c24\u2250\u27d7\u2442\u8097\u484b\u6c25\u7e12',
  '\u8709\u4b84\u6dc2\u3ee1\u2770\u5bb8\u35dc\u22ee\u1977\u14bb\u525d\u712e',
  '\u8097\u484b\u6c25\u7e12\u8708\u5502\u8d70\u59b9\u6d5d\u622e\u5937\u349b',
  '\u624d\u7926\u8493\u4a49\u6d24\u7e92\u4749\u2ba4\u5dd2\u36e9\u2374\u59ba',
  '\u34dd\u226e\u5937\u349b\u624d\u7926\u8493\u40c2\u6ddc\u3eee\u2777\u1bbb',
  '\u123c\u5b48\u35a4\u22d2\u1969\u14b4\u525a\u312d\u2096\u584b\u3425\u6212',
  '\u7909\u4484\u6a42\u3d21\u2690\u5b48\u35a4\u22d2\u1969\u14b4\u525a\u312d',
  '\u2096\u50be\u6c5d\u2292\u3949\u24a4\u5a52\u3529\u2294\u594a\u34a5\u2252',
  '\u5929\u3494\u624a\u3925\u2492\u5a49\u3524\u6292\u3949\u24a4\u5a52\u3529',
  '\u2294\u594a\u34a0\u40ee\u2717\u1b9b\u55c5\u72c1\u29dc\u3e2e\u2737\u1b8b',
  '\u55cd\u7ae6\u8573\u4ab9\u6d5c\u7eae\u4757\u2bab\u5dd5\u76ea\u8375\u49ba',
  '\u6cdd\u3e6e\u6737\u3b9b\u65cd\u7ae6\u8573\u4849\u6d20\u45ee\u2777\u1bbb',
  '\u55dd\u72ee\u8177\u48bb\u6c5d\u7e2e\u8717\u4b8b\u6dc5\u7ee2\u8771\u4bb8',
  '\u6ddc\u3eee\u2777\u1bbb\u162d\u5c92\u1969\u14b4\u525a\u312d\u2096\u584b',
  '\u3425\u6212\u7909\u4484\u6a42\u3d21\u2690\u5b48\u3077\u7e2e\u8729\u24a4',
  '\u5a52\u3529\u2294\u594a\u34a5\u2252\u5929\u3494\u624a\u3925\u2492\u5a49',
  '\u3079\u3e2e\u4717\u1b8b\u5dc5\u5f6c\u2776\u222e\u2737\u1b8b\u55cd\u72e6',
  '\u8375\u49ba\u6cdd\u3e6e\u6737\u3b9b\u65cd\u7ae6\u8561\u4db1\u3577\u48bb',
  '\u6c5d\u7e2e\u8717\u4b8b\u6dc5\u7ee2\u8771\u40c4\u68c0\u5b48\u35a4\u22d2',
  '\u1968\u147a\u8771\u4bbb\u3525\u3c12\u55d5\u72e2\u8160\u12ea\u5444\u3222',
  '\u2311\u1888\u54c4\u3012\u2c55\u7226\u8513\u4a80\u3476\u14c2\u2117\u188b',
  '\u5445\u7012\u1c44\u3626\u2513\u1a89\u5024\u1804\u7375\u19ba\u54dd\u326e',
  '\u6009\u1ac1\u26c5\u7222\u8111\u4888\u6c02\u2e88\u54c5\u3262\u6131\u3898',
  '\u1125\u3ea2\u4751\u2ba8\u5dd4\u111e\u6826\u6888\u6c44\u3e22\u2700\u57e2',
  '\u4111\u2898\u644c\u3a26\u1090\u3e60\u198d\u7226\u8375\u49ba\u6cd8\u224b',
  '\u6dc5\u7ee2\u8761\u891a\u1c0c\u1604\u6717\u188b\u5445\u703c\u5303\u3181',
  '\u50c0\u5c6e\u6151\u28a8\u5c07\u4068\u4030\u2818\u6c8c\u1686\u3303\u1b91',
  '\u58c0\u5b2e\u2717\u1b9b\u55c5\u72e6\u8161\u7418\u1d0c\u1604\u1920\u7860',
  '\u4030\u2406\u1317\u2191\u50a0\u2818\u695d\u539c\u4030\u2818\u1925\u5107',
  '\u1c0c\u1686\u1303\u1181\u5dc8\u7460\u4572\u2918\u1d5c\u5646\u1356\u43b0',
  '\u7d8c\u1686\u1302\u35b3\u5d86\u6060\u4034\u2818\u6c8c\u1686\u7303\u1b91',
  '\u5dc8\u7068\u4630\u28b1\u1361\u5d18\u1d0c\u1604\u5b62\u2ec3\u2630\u2a18',
  '\u1d5c\u5646\u1317\u2181\u50c8\u706a\u8232\u2818\u6822\u417a\u72d5\u5326',
  '\u8233\u4918\u1d0c\u5606\u262f\u3c34\u8633\u7c32\u2638\u7c01\u636b\u71e1',
  '\u80e0\u5bae\u1f36\u1255\u4dbc\u2edc\u1943\u71e5\u84f2\u8025\u35d3\u76e9',
  '\u7094\u3c13\u3bc3\u512f\u4c3c\u6c23\u8716\u1a5b\u1495\u6bb0\u3397\u3b6a',
  '\u708c\u3e2e\u2797\u1b8b\u2558\u204b\u356a\u3ead\u6582\u13b8\u6a36\u56e2',
  '\u8171\u4bb8\u6c59\u3ac3\u7371\u4fb4\u4716\u56d4\u6bb6\u1f1b\u55ed\u63b4',
  '\u468d\u72e2\u8175\u48b8\u6c5a\u6b72\u71bd\u4eb4\u8717\u8b46\u8168\u7cf6',
  '\u71bd\u48bd\u6a76\u56d0\u6c5c\u3e2e\u2757\u1b8b\u55ab\u49b0\u7fdd\u7d5b',
  '\u4571\u4fb4\u4695\u53b6\u8b6d\u7dbb\u3768\u7d0b\u55c5\u72e2\u8571\u48b8',
  '\u6ab7\u2b0c\u5db7\u49bb\u6945\u72fe\u785c\u3d2b\u1765\u8adb\u6b76\u5ed1',
  '\u6a17\u1b8b\u55c5\u7ae2\u8171\u40e0\u6a97\u2bbb\u245c\u3fad\u1dc5\u62b0',
  '\u865f\u3d7b\u55d5\u596e\u4685\u5f6c\u27d6\u62e6\u8765\u1b8b\u8586\u36cf',
  '\u8717\u7b5e\u8160\u562d\u75cd\u7ee2\u7094\u7e2f\u66bd\u72c1\u1c5b\u4b8b',
  '\u5dd5\u76c1\u255f\u3c12\u5d86\u4ec0\u1d0f\u1000',
  '|afe800b9',
].join('');

/** Celé úložiště hry profilu po verzi před #102 jako dvojice klíč a hodnota. */
export const LEGACY_P3_DOTS_STORAGE: ReadonlyArray<readonly [string, string]> = [
  ['recentColors.house', '2,1'],
  ['toolPanel.seen', '1'],
  ['picture.house', LEGACY_P3_DOTS_RECORD],
  ['lineSize', 'medium'],
];

/**
 * Barvy všech pixelů po řádcích jako úseky „hodnota a počet“: „-364“ je
 * 364 pixelů bez barvy, „42“ dva pixely barvy 4. Barva je jeden znak
 * v soustavě o základu 36 (0–9, a = 10, b = 11), zbytek je počet.
 */
const LEGACY_P3_DOTS_PIXEL_RUNS = [
  '-6018 44 -2 41 -290 41 -3 42 -3 42 -3 42 -3 41 -579 42 -3 42 -3 42 -3 42 -3 42 -3 42',
  '-3 42 -3 42 -3 41 -258 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 42',
  '-246 41 -1 44 -1 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 42',
  '947 -192 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93',
  '42 943 -192 9108 -186 41 -3 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42',
  '93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 924 -185 42 -1 44 91 44 91 44 91 44 91',
  '44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44',
  '91 44 913 -185 42 -1 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91',
  '44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 93 -185 41 -3 42 93 42',
  '93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93',
  '42 93 42 93 42 93 42 93 42 93 42 93 41 -191 9108 -190 42 93 42 93 42 93 42 93 42 93 42',
  '93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93 42 93',
  '42 93 42 93 42 -185 41 -1 44 -1 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91',
  '44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 91 44 -1 44 -186 44 -1',
  '44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44',
  '-1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 41 -185 42 -3 42 -3 42 -3 42 -3 42 -3 42',
  '-3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3',
  '42 -3 42 -3 42 -489 41 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3',
  '42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 41 -188 44 -1',
  '44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44',
  '-1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 42 -198 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44',
  '-1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 42',
  '-209 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42',
  '-3 42 -3 42 -3 42 -3 42 -3 41 -529 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42',
  '-3 42 -3 42 -3 42 -3 42 -3 42 -239 42 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44',
  '-1 44 -1 44 -1 44 -1 44 -1 41 -246 42 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44 -1 44',
  '-1 44 -1 44 -258 41 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -3 42 -579 41 -3 42 -3',
  '42 -3 42 -3 41 -290 41 -2 44 -12316 84 -1 84 -1 82 -285 81 -3 82 -3 82 -3 81 -584 82',
  '-3 82 -3 82 -3 81 -283 84 -1 84 -1 84 -1 82 -281 81 -1 84 -1 84 -1 84 -1 82 -284 82 -3',
  '82 -3 82 -3 81 -580 81 -3 82 -3 82 -3 82 -3 81 -280 82 -1 84 -1 84 -1 84 -1 82 -280 82',
  '-1 84 -1 84 -1 84 -1 82 -280 81 -3 82 -3 82 -3 82 -3 81 -584 82 -3 82 -3 82 -3 81 -281',
  '81 -1 84 -1 84 -1 84 -1 82 -283 84 -1 84 -1 84 -1 82 -284 82 -3 82 -3 82 -3 81 -543 11',
  '-2 14 -35 81 -3 82 -3 82 -3 81 -236 12 -2 14 -2 14 -38 84 -1 84 -1 82 -229 11 -2 14 -2',
  '12 -2 14 -2 14 -270 12 -2 14 -2 14 -2 12 -2 14 -2 14 -263 11 -2 16 -2 16 -2 16 -2 16',
  '-262 16 -2 16 -2 16 -2 16 -2 11 -258 13 -2 16 -2 16 -2 16 -2 16 -258 12 -2 16 -2 16 -2',
  '16 -2 16 -259 13 -2 12 -2 12 -2 16 -2 12 -2 12 -2 16 -258 12 -2 16 -2 12 -2 12 -2 16',
  '-2 12 -2 12 -264 18 -2 14 -2 18 -2 14 -270 18 -2 14 -2 17 -277 12 -2 12 -2 12 -2 14',
  '-284 12 -2 12 -2 11 -7201 74 -297 72 -594 71 -3 72 -3 71 -290 72 -1 74 -1 72 -290 72',
  '-1 74 -1 72 -290 71 -3 72 -3 71 -594 72 -297 74 -137 b2 -298 b2 -18 b1 -278 b4 -17 b2',
  '-274 b10 -14 b2 -18 b1 -254 b12 -12 b4 -17 b2 -254 b10 -10 b10 -14 b2 -18 b1 -236 b8',
  '-10 b12 -12 b3 -18 b2 -236 b6 -12 b10 -10 b10 -13 b3 -18 b1 -216 b8 -12 b8 -10 b12 -12',
  'b3 -18 b1 -19 b1 -196 b8 -13 b6 -12 b10 -9 b11 -13 b3 -18 b1 -196 b2 -4 b2 -12 b7 -13',
  'b8 -10 b12 -12 b3 -18 b1 -196 b1 -6 b1 -12 b8 -12 b7 -12 b10 -9 b11 -13 b3 -215 b2 -4',
  'b2 -12 b7 -13 b8 -9 b13 -12 b3 -222 b1 -12 b8 -12 b7 -12 b10 -9 b11 -231 b2 -4 b2 -12',
  'b7 -13 b7 -10 b13 -237 b1 -12 b3 -1 b4 -12 b7 -12 b9 -252 b2 -4 b2 -12 b7 -13 b7 -252',
  'b1 -7 b1 -12 b3 -1 b3 -13 b7 -273 b2 -4 b2 -12 b7 -272 b1 -7 b1 -12 b3 -1 b3 -292 b3',
  '-3 b3 -291 b1 -7 b1 -7216',
].join(' ');

/** Očekávané barvy pixelů po řádcích (`null` bez barvy a na obrysu). */
export function legacyP3DotsPixels(): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (const run of LEGACY_P3_DOTS_PIXEL_RUNS.split(' ')) {
    const color = run.startsWith('-') ? null : Number.parseInt(run.charAt(0), 36);
    const count = Number(run.slice(1));
    for (let step = 0; step < count; step += 1) {
      pixels.push(color);
    }
  }
  return pixels;
}
