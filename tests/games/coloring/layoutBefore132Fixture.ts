/**
 * Pevné místo knihy na výběru omalovánky před #132 (commit 7be9767, sprint 4
 * po #131), v CSS px okna pro všechna okna `COLORING_WINDOWS`: levý, horní,
 * pravý a spodní okraj knihy.
 *
 * Hlídá #132 AC4: mřížka výběru se změní na 12 míst, ale kniha „zůstane na
 * svém místě“.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #132 vypsal `layoutPicker(area).book` převedené na CSS
 * px, zaokrouhlené na tisíciny px. Míry se nesmí přegenerovat z nové verze
 * hry, jinak by test nic nehlídal. Až úkol knihu záměrně posune, upraví se
 * tabulka v tom úkolu s odkazem na něj.
 */

/** Okno, levý, horní, pravý a spodní okraj knihy v CSS px. */
export const BOOK_BEFORE_132: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ['iPad 1180×820', 1092, 12, 1168, 88],
  ['iPad 1180×760', 1092, 12, 1168, 88],
  ['932×500 těsně nad hranicí', 844, 12, 920, 88],
  ['744×296 nejmenší telefon', 672, 8, 736, 72],
  ['800×300 Samsung s Chromem', 728, 8, 792, 72],
  ['844×340 iPhone se Safari', 725, 8, 789, 72],
  ['932×430 iPhone Pro Max', 801, 8, 865, 72],
  ['932×499 těsně pod hranicí', 860, 8, 924, 72],
  ['932×499 těsně pod hranicí s výřezem', 801, 8, 865, 72],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 318, 55, 382, 119],
  ['390×664 iPhone v Safari s lištou', 318, 8, 382, 72],
  ['360×780 Samsung s Chromem', 288, 8, 352, 72],
  ['375×667 iPhone SE', 303, 8, 367, 72],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 358, 67, 422, 131],
  ['360×620 nejmenší telefon na výšku', 288, 8, 352, 72],
  ['414×622 iPhone 8 Plus v Safari s lištami', 342, 8, 406, 72],
  ['499×932 těsně pod hranicí šířky', 427, 8, 491, 72],
  ['375×1180 úzký iPad (Split View)', 303, 8, 367, 72],
  ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 1092, 36, 1168, 112],
  ['iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)', 358, 67, 422, 131],
  ['iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)', 321, 67, 385, 131],
  ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', 801, 8, 865, 72],
];
