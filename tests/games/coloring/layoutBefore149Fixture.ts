/**
 * Pevná velikost náhledu v albu Omalovánek před #149 (commit e989dca,
 * sprint 4 po #155), v CSS px okna pro všechna okna `COLORING_WINDOWS`:
 * šířka a výška jednoho náhledu (všechny náhledy alba jsou stejně velké).
 *
 * Hlídá #149 AC6: s listováním po 12 a šipkami „náhledy mají stejnou
 * velikost jako dnes“.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #149 vypsal `layoutAlbum(area).previews[0]` převedený
 * na CSS px, zaokrouhlený na tisíciny px. Míry se nesmí přegenerovat
 * z nové verze hry, jinak by test nic nehlídal. Až úkol náhledy alba
 * záměrně zvětší nebo zmenší, upraví se tabulka v tom úkolu s odkazem na něj.
 */

/** Okno, šířka a výška náhledu alba v CSS px. */
export const ALBUM_PREVIEW_BEFORE_149: ReadonlyArray<readonly [string, number, number]> = [
  ['iPad 1180×820', 229, 171.75],
  ['iPad 1180×760', 229, 171.75],
  ['932×500 těsně nad hranicí', 167, 125.25],
  ['744×296 nejmenší telefon', 110.222, 82.667],
  ['800×300 Samsung s Chromem', 112, 84],
  ['844×340 iPhone se Safari', 120.444, 90.333],
  ['932×430 iPhone Pro Max', 151.5, 113.625],
  ['932×499 těsně pod hranicí', 181, 135.75],
  ['932×499 těsně pod hranicí s výřezem', 151.5, 113.625],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 132.222, 99.167],
  ['390×664 iPhone v Safari s lištou', 114, 85.5],
  ['360×780 Samsung s Chromem', 136, 102],
  ['375×667 iPhone SE', 110.889, 83.167],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 149.111, 111.833],
  ['360×620 nejmenší telefon na výšku', 104, 78],
  ['414×622 iPhone 8 Plus v Safari s lištami', 122, 91.5],
  ['499×932 těsně pod hranicí šířky', 169.778, 127.333],
  ['375×1180 úzký iPad (Split View)', 171.5, 128.625],
  ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 229, 171.75],
  ['iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)', 149.111, 111.833],
  ['iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)', 131.333, 98.5],
  ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', 151.5, 113.625],
];
