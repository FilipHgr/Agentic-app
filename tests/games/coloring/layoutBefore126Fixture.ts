/**
 * Pevné míry rozložení Omalovánek před #126 (commit d69a51a, sprint 4 po
 * #125), v CSS px okna pro všechna okna `COLORING_WINDOWS`:
 * - plocha omalovánky v malování (šířka, výška) se zavřeným panelem,
 * - mřížka výběru omalovánky z #124: levý a horní okraj 1. náhledu, pravý
 *   a spodní okraj 6. náhledu a rozměr náhledu.
 *
 * Hlídají #126 AC6: fotoaparát obrázek jen posune, velikost zůstane
 * (rozhodnutí v komentáři k #126: „obrázek se jen posune“), a kniha
 * mřížku výběru nezmění.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #126 vypsal `coloringCase(window).picture`
 * a `layoutPicker(area).previews` převedené na CSS px, zaokrouhlené na
 * tisíciny px.
 *
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol mimo #126 velikost obrázku záměrně změní (třeba obrázek na výšku
 * bez otočení, #127, #128), upraví se tabulka v tom úkolu s odkazem na něj.
 */

/** Okno, šířka a výška plochy omalovánky v CSS px. */
export const PICTURE_SIZE_BEFORE_126: ReadonlyArray<readonly [string, number, number]> = [
  ['iPad 1180×820', 1076, 807],
  ['iPad 1180×760', 1013.333, 760],
  ['932×500 těsně nad hranicí', 666.667, 500],
  ['744×296 nejmenší telefon', 394.667, 296],
  ['800×300 Samsung s Chromem', 400, 300],
  ['844×340 iPhone se Safari', 425.333, 319],
  ['932×430 iPhone Pro Max', 545.333, 409],
  ['932×499 těsně pod hranicí', 665.333, 499],
  ['932×499 těsně pod hranicí s výřezem', 637.333, 478],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 374, 498.667],
  ['390×664 iPhone v Safari s lištou', 374, 498.667],
  ['360×780 Samsung s Chromem', 344, 458.667],
  ['375×667 iPhone SE', 359, 478.667],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 414, 552],
  ['360×620 nejmenší telefon na výšku', 344, 458.667],
  ['414×622 iPhone 8 Plus v Safari s lištami', 346.5, 462],
  ['499×932 těsně pod hranicí šířky', 483, 644],
  ['375×1180 úzký iPad (Split View)', 359, 478.667],
  ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 1034.667, 776],
  ['iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)', 414, 552],
  ['iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)', 377, 502.667],
  ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', 545.333, 409],
];

/**
 * Okno, levý a horní okraj 1. náhledu, pravý a spodní okraj 6. náhledu
 * a šířka a výška náhledu v CSS px.
 */
export const PICKER_GRID_BEFORE_126: ReadonlyArray<
  readonly [string, number, number, number, number, number, number]
> = [
  ['iPad 1180×820', 96, 163, 1084, 657, 313.333, 235],
  ['iPad 1180×760', 96, 133, 1084, 627, 313.333, 235],
  ['932×500 těsně nad hranicí', 96, 65, 836, 435, 230.667, 173],
  ['744×296 nejmenší telefon', 92, 8, 652, 288, 176, 132],
  ['800×300 Samsung s Chromem', 116, 8, 684, 292, 178.667, 134],
  ['844×340 iPhone se Safari', 127, 12, 717, 307, 186, 139.5],
  ['932×430 iPhone Pro Max', 139, 41, 793, 368, 207.333, 155.5],
  ['932×499 těsně pod hranicí', 80, 56.5, 852, 442.5, 246.667, 185],
  ['932×499 těsně pod hranicí s výřezem', 139, 75.5, 793, 402.5, 207.333, 155.5],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 8, 247.125, 382, 681.875, 179, 134.25],
  ['390×664 iPhone v Safari s lištou', 8, 150.625, 382, 585.375, 179, 134.25],
  ['360×780 Samsung s Chromem', 8, 225.5, 352, 626.5, 164, 123],
  ['375×667 iPhone SE', 8, 160.563, 367, 578.438, 171.5, 128.625],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 8, 274.625, 422, 754.375, 199, 149.25],
  ['360×620 nejmenší telefon na výšku', 8, 145.5, 352, 546.5, 164, 123],
  ['414×622 iPhone 8 Plus v Safari s lištami', 8, 116.125, 406, 577.875, 191, 143.25],
  ['499×932 těsně pod hranicí šířky', 8, 223.313, 491, 780.688, 233.5, 175.125],
  ['375×1180 úzký iPad (Split View)', 8, 417.063, 367, 834.938, 171.5, 128.625],
  ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 96, 165, 1084, 659, 313.333, 235],
  ['iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)', 8, 274.625, 422, 754.375, 199, 149.25],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    8,
    255.438,
    385,
    693.563,
    180.5,
    135.375,
  ],
  ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', 139, 41, 793, 368, 207.333, 155.5],
];
