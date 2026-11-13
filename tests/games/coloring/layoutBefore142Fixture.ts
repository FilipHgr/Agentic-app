/**
 * Pevné místo a velikost obrázku v malování před #142 (commit 5a2682f,
 * sprint 4 po #141), v CSS px okna pro všechna okna `COLORING_WINDOWS`:
 * levý a horní okraj, šířka a výška plochy omalovánky se zavřeným panelem
 * (rozložení je pro zavřený panel i oba kroky stejné).
 *
 * Hlídají #142 AC6: koště obrázek v žádném okně nezmenší ani nezvětší
 * a posunout ho smí jen v okně 932×499 s výřezem, kde se pruh se dvěma
 * sloupci a koštětem vedle obrázku jinak nevejde.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #142 vypsal `coloringCase(window).picture` z
 * `coloringLayoutScenes.ts` zaokrouhlené na tisíciny px.
 *
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol mimo #142 obrázek záměrně změní, upraví se tabulka v tom úkolu
 * s odkazem na něj.
 */

/** Okno, levý a horní okraj, šířka a výška plochy omalovánky v CSS px. */
export const PICTURE_BEFORE_142: ReadonlyArray<readonly [string, number, number, number, number]> =
  [
    ['iPad 1180×820', 96, 6.5, 1076, 807],
    ['iPad 1180×760', 127.333, 0, 1013.333, 760],
    ['932×500 těsně nad hranicí', 218.667, 0, 666.667, 500],
    ['744×296 nejmenší telefon', 246.667, 0, 394.667, 296],
    ['800×300 Samsung s Chromem', 272, 0, 400, 300],
    ['844×340 iPhone se Safari', 281.333, 0, 425.333, 319],
    ['932×430 iPhone Pro Max', 265.333, 0, 545.333, 409],
    ['932×499 těsně pod hranicí', 169.333, 0, 665.333, 499],
    ['932×499 těsně pod hranicí s výřezem', 183.333, 0, 637.333, 478],
    ['390×844 iPhone 13–15 (výřez 47, lišta 34)', 8, 288.25, 374, 280.5],
    ['390×664 iPhone v Safari s lištou', 8, 191.75, 374, 280.5],
    ['360×780 Samsung s Chromem', 8, 261, 344, 258],
    ['375×667 iPhone SE', 8, 198.875, 359, 269.25],
    ['430×932 iPhone Pro Max (výřez 59, lišta 34)', 8, 323.25, 414, 310.5],
    ['360×620 nejmenší telefon na výšku', 8, 181, 344, 258],
    ['414×622 iPhone 8 Plus v Safari s lištami', 8, 161.75, 398, 298.5],
    ['499×932 těsně pod hranicí šířky', 8, 284.875, 483, 362.25],
    ['375×1180 úzký iPad (Split View)', 8, 455.375, 359, 269.25],
    ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', 116.667, 24, 1034.667, 776],
    ['iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)', 8, 323.25, 414, 310.5],
    ['iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)', 8, 297.125, 377, 282.75],
    ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', 265.333, 0, 545.333, 409],
  ];

/** Jediné okno, ve kterém se obrázek smí posunout (#142 AC6). */
export const PICTURE_MAY_MOVE_IN = '932×499 těsně pod hranicí s výřezem';
