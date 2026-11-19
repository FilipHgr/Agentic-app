/**
 * Pevné míry alba Omalovánek po #149 a před #158 (sprint 4, commit 141b0e5),
 * v CSS px okna pro všechna okna `COLORING_WINDOWS`: levý a horní okraj
 * 1. místa, pravý a spodní okraj 12. místa a šířka a výška náhledu. Album
 * s jedinou stránkou (`'one'`, do 12 obrázků, bez šipek) a s víc stránkami
 * (`'many'`, od 13 obrázků, se šipkami ◀ ▶); se šipkami se mřížka v některých
 * oknech posune.
 *
 * Hlídá #158 AC1 „Náhledy mají stejnou velikost i místo jako po #149“, které
 * nahrazuje kontrolu „pixel po pixelu“ z #149 AC3 (karta stránky pod náhledy
 * album vizuálně změní, místo a velikost náhledů ne).
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový výpis
 * nad verzí hry před #158 vypsal `layoutAlbum(area, { pictureCount: 12 })`
 * a `layoutAlbum(area, { pictureCount: 13 })` převedené na CSS px,
 * zaokrouhlené na tisíciny px. Míry se nesmí přegenerovat z nové verze hry,
 * jinak by test nic nehlídal. Až úkol náhledy alba záměrně přesune, upraví
 * se tabulka v tom úkolu s odkazem na něj.
 */

/** Album s jedinou stránkou (bez šipek), nebo s víc stránkami (se šipkami). */
export type AlbumPagesKind = 'one' | 'many';

/**
 * Okno, druh alba, levý a horní okraj 1. místa, pravý a spodní okraj
 * 12. místa a šířka a výška náhledu v CSS px.
 */
export const ALBUM_GRID_BEFORE_158: ReadonlyArray<
  readonly [string, AlbumPagesKind, number, number, number, number, number, number]
> = [
  ['iPad 1180×820', 'one', 96, 128.375, 1084, 691.625, 229, 171.75],
  ['iPad 1180×820', 'many', 96, 128.375, 1084, 691.625, 229, 171.75],
  ['iPad 1180×760', 'one', 96, 98.375, 1084, 661.625, 229, 171.75],
  ['iPad 1180×760', 'many', 96, 98.375, 1084, 661.625, 229, 171.75],
  ['932×500 těsně nad hranicí', 'one', 96, 38.125, 836, 461.875, 167, 125.25],
  ['932×500 těsně nad hranicí', 'many', 96, 38.125, 836, 461.875, 167, 125.25],
  ['744×296 nejmenší telefon', 'one', 127.556, 8, 616.444, 288, 110.222, 82.667],
  ['744×296 nejmenší telefon', 'many', 127.556, 8, 616.444, 288, 110.222, 82.667],
  ['800×300 Samsung s Chromem', 'one', 152, 8, 648, 292, 112, 84],
  ['800×300 Samsung s Chromem', 'many', 152, 8, 648, 292, 112, 84],
  ['844×340 iPhone se Safari', 'one', 157.111, 8, 686.889, 311, 120.444, 90.333],
  ['844×340 iPhone se Safari', 'many', 157.111, 8, 686.889, 311, 120.444, 90.333],
  ['932×430 iPhone Pro Max', 'one', 139, 18.063, 793, 390.938, 151.5, 113.625],
  ['932×430 iPhone Pro Max', 'many', 215, 18.063, 869, 390.938, 151.5, 113.625],
  ['932×499 těsně pod hranicí', 'one', 80, 29.875, 852, 469.125, 181, 135.75],
  ['932×499 těsně pod hranicí', 'many', 156, 29.875, 928, 469.125, 181, 135.75],
  ['932×499 těsně pod hranicí s výřezem', 'one', 139, 52.563, 793, 425.438, 151.5, 113.625],
  ['932×499 těsně pod hranicí s výřezem', 'many', 215, 52.563, 869, 425.438, 151.5, 113.625],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 'one', 54.778, 127, 335.222, 802, 132.222, 99.167],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 'many', 54.778, 131, 335.222, 806, 132.222, 99.167],
  ['390×664 iPhone v Safari s lištou', 'one', 8, 173, 382, 563, 114, 85.5],
  ['390×664 iPhone v Safari s lištou', 'many', 8, 173, 382, 563, 114, 85.5],
  ['360×780 Samsung s Chromem', 'one', 36, 80, 324, 772, 136, 102],
  ['360×780 Samsung s Chromem', 'many', 36, 84, 324, 776, 136, 102],
  ['375×667 iPhone SE', 'one', 68.611, 80, 306.389, 659, 110.889, 83.167],
  ['375×667 iPhone SE', 'many', 68.611, 84, 306.389, 663, 110.889, 83.167],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    'one',
    57.889,
    139,
    372.111,
    890,
    149.111,
    111.833,
  ],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    'many',
    57.889,
    143,
    372.111,
    894,
    149.111,
    111.833,
  ],
  ['360×620 nejmenší telefon na výšku', 'one', 8, 166, 352, 526, 104, 78],
  ['360×620 nejmenší telefon na výšku', 'many', 8, 166, 352, 526, 104, 78],
  ['414×622 iPhone 8 Plus v Safari s lištami', 'one', 8, 140, 406, 554, 122, 91.5],
  ['414×622 iPhone 8 Plus v Safari s lištami', 'many', 8, 124, 406, 538, 122, 91.5],
  ['499×932 těsně pod hranicí šířky', 'one', 71.722, 80, 427.278, 924, 169.778, 127.333],
  ['499×932 těsně pod hranicí šířky', 'many', 71.722, 84, 427.278, 928, 169.778, 127.333],
  ['375×1180 úzký iPad (Split View)', 'one', 8, 200.125, 367, 1051.875, 171.5, 128.625],
  ['375×1180 úzký iPad (Split View)', 'many', 8, 200.125, 367, 1051.875, 171.5, 128.625],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    'one',
    96,
    130.375,
    1084,
    693.625,
    229,
    171.75,
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    'many',
    96,
    130.375,
    1084,
    693.625,
    229,
    171.75,
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    'one',
    57.889,
    139,
    372.111,
    890,
    149.111,
    111.833,
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    'many',
    57.889,
    143,
    372.111,
    894,
    149.111,
    111.833,
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    'one',
    57.167,
    139,
    335.833,
    810,
    131.333,
    98.5,
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    'many',
    57.167,
    143,
    335.833,
    814,
    131.333,
    98.5,
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    'one',
    139,
    18.063,
    793,
    390.938,
    151.5,
    113.625,
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    'many',
    215,
    18.063,
    869,
    390.938,
    151.5,
    113.625,
  ],
];
