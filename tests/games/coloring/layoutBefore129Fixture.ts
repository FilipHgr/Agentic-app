/**
 * Pevné míry alba Omalovánek z #126 před #129, v CSS px okna pro všechna
 * okna `COLORING_WINDOWS`: levý a horní okraj 1. náhledu, pravý a spodní
 * okraj 12. náhledu a šířka a výška náhledu.
 *
 * Hlídají #129 AC6 „Album z #126 zůstane beze změny“: velký obrázek a koš
 * rozložení alba nezmění.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový výpis
 * nad verzí hry před #129 (sprint 4 po #128) vypsal `layoutAlbum(area)
 * .previews` převedené na CSS px, zaokrouhlené na tisíciny px.
 *
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol mimo #129 album záměrně změní, upraví se tabulka v tom úkolu
 * s odkazem na něj.
 */

/**
 * Okno, levý a horní okraj 1. náhledu alba, pravý a spodní okraj 12. náhledu
 * a šířka a výška náhledu v CSS px.
 */
export const ALBUM_GRID_BEFORE_129: ReadonlyArray<
  readonly [string, number, number, number, number, number, number]
> = [
  ['iPad 1180×820', 96, 128.375, 1084, 691.625, 229, 171.75],
  ['iPad 1180×760', 96, 98.375, 1084, 661.625, 229, 171.75],
  ['932×500 těsně nad hranicí', 96, 38.125, 836, 461.875, 167, 125.25],
  ['744×296 nejmenší telefon', 127.556, 8, 616.444, 288, 110.222, 82.667],
  ['800×300 Samsung s Chromem', 152, 8, 648, 292, 112, 84],
  ['844×340 iPhone se Safari', 157.111, 8, 686.889, 311, 120.444, 90.333],
  ['932×430 iPhone Pro Max', 139, 18.063, 793, 390.938, 151.5, 113.625],
  ['932×499 těsně pod hranicí', 80, 29.875, 852, 469.125, 181, 135.75],
  ['932×499 těsně pod hranicí s výřezem', 139, 52.563, 793, 425.438, 151.5, 113.625],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 54.778, 127, 335.222, 802, 132.222, 99.167],
  ['390×664 iPhone v Safari s lištou', 8, 173, 382, 563, 114, 85.5],
  ['360×780 Samsung s Chromem', 36, 80, 324, 772, 136, 102],
  ['375×667 iPhone SE', 68.611, 80, 306.389, 659, 110.889, 83.167],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 57.889, 139, 372.111, 890, 149.111, 111.833],
  ['360×620 nejmenší telefon na výšku', 8, 166, 352, 526, 104, 78],
  ['414×622 iPhone 8 Plus v Safari s lištami', 8, 140, 406, 554, 122, 91.5],
  ['499×932 těsně pod hranicí šířky', 71.722, 80, 427.278, 924, 169.778, 127.333],
  ['375×1180 úzký iPad (Split View)', 8, 200.125, 367, 1051.875, 171.5, 128.625],
  ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 96, 130.375, 1084, 693.625, 229, 171.75],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    57.889,
    139,
    372.111,
    890,
    149.111,
    111.833,
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    57.167,
    139,
    335.833,
    810,
    131.333,
    98.5,
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    139,
    18.063,
    793,
    390.938,
    151.5,
    113.625,
  ],
];
