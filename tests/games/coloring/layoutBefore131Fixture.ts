/**
 * Pevné míry velkého obrázku a koše Omalovánek z #129 před #131, v CSS px
 * okna pro všechna okna `COLORING_WINDOWS`: levý, horní, pravý a spodní
 * okraj velkého obrázku a koše.
 *
 * Hlídají #131 AC7 „Velký obrázek a koš mají stejnou velikost i místo jako
 * v #129. Obrázek se nezmenší ani neposune“: tlačítko malovat dál rozložení
 * velkého obrázku a koše nezmění.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový výpis
 * nad verzí hry před #131 (sprint 4 po #130) vypsal `layoutBigPicture(area)`
 * (`picture` a `trash`) převedené na CSS px, zaokrouhlené na tisíciny px.
 *
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol mimo #131 velký obrázek nebo koš záměrně změní, upraví se tabulka
 * v tom úkolu s odkazem na něj.
 */

/**
 * Okno, levý, horní, pravý a spodní okraj velkého obrázku a levý, horní,
 * pravý a spodní okraj koše v CSS px.
 */
export const BIG_PICTURE_BEFORE_131: ReadonlyArray<
  readonly [string, number, number, number, number, number, number, number, number]
> = [
  ['iPad 1180×820', 104, 6.5, 1180, 813.5, 12, 432, 88, 508],
  ['iPad 1180×760', 127.333, 0, 1140.667, 760, 12, 432, 88, 508],
  ['932×500 těsně nad hranicí', 218.667, 0, 885.333, 500, 12, 412, 88, 488],
  ['744×296 nejmenší telefon', 246.667, 0, 641.333, 296, 8, 224, 72, 288],
  ['800×300 Samsung s Chromem', 272, 0, 672, 300, 8, 228, 72, 292],
  ['844×340 iPhone se Safari', 281.333, 0, 706.667, 319, 55, 247, 119, 311],
  ['932×430 iPhone Pro Max', 265.333, 0, 810.667, 409, 67, 337, 131, 401],
  ['932×499 těsně pod hranicí', 169.333, 0, 834.667, 499, 8, 368, 72, 432],
  ['932×499 těsně pod hranicí s výřezem', 183.333, 0, 820.667, 478, 67, 368, 131, 432],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 8, 288.25, 382, 568.75, 318, 55, 382, 119],
  ['390×664 iPhone v Safari s lištou', 8, 191.75, 382, 472.25, 318, 8, 382, 72],
  ['360×780 Samsung s Chromem', 8, 261, 352, 519, 288, 8, 352, 72],
  ['375×667 iPhone SE', 8, 198.875, 367, 468.125, 303, 8, 367, 72],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 8, 323.25, 422, 633.75, 358, 67, 422, 131],
  ['360×620 nejmenší telefon na výšku', 8, 181, 352, 439, 288, 8, 352, 72],
  ['414×622 iPhone 8 Plus v Safari s lištami', 8, 161.75, 406, 460.25, 342, 8, 406, 72],
  ['499×932 těsně pod hranicí šířky', 8, 284.875, 491, 647.125, 427, 8, 491, 72],
  ['375×1180 úzký iPad (Split View)', 8, 455.375, 367, 724.625, 303, 8, 367, 72],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    116.667,
    24,
    1151.333,
    800,
    12,
    456,
    88,
    532,
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    8,
    323.25,
    422,
    633.75,
    358,
    67,
    422,
    131,
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    8,
    297.125,
    385,
    579.875,
    321,
    67,
    385,
    131,
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    265.333,
    0,
    810.667,
    409,
    67,
    337,
    131,
    401,
  ],
];
