/**
 * Pevné míry malování před #148 (commit 3eaad52, sprint 4 po #143), v CSS px
 * okna pro všechna okna `COLORING_WINDOWS`: plocha omalovánky se zavřeným
 * panelem (rozložení je pro zavřený panel i oba kroky stejné) a na výšku
 * dvě místa nedávných barev (#99) v pořadí pruhu.
 *
 * Hlídají #148 AC7 (obrázek má stejnou velikost jako dnes) a AC1 (na výšku
 * jsou tlačítka předchozího nástroje a gumy na dnešním místě nedávných
 * barev).
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #148 vypsal `coloringCase(window).picture`
 * a `coloringCase(window).recentColors` z `coloringLayoutScenes.ts`
 * zaokrouhlené na tisíciny px.
 *
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol mimo #148 obrázek záměrně změní, upraví se tabulka v tom úkolu
 * s odkazem na něj.
 */

/** Levý a horní okraj, šířka a výška v CSS px. */
export type FixedRect = readonly [number, number, number, number];

/** Okno, plocha omalovánky a místa nedávných barev (jen na výšku, na šířku prázdné). */
export const LAYOUT_BEFORE_148: ReadonlyArray<readonly [string, FixedRect, readonly FixedRect[]]> =
  [
    ['iPad 1180×820', [96, 6.5, 1076, 807], []],
    ['iPad 1180×760', [127.333, 0, 1013.333, 760], []],
    ['932×500 těsně nad hranicí', [218.667, 0, 666.667, 500], []],
    ['744×296 nejmenší telefon', [246.667, 0, 394.667, 296], []],
    ['800×300 Samsung s Chromem', [272, 0, 400, 300], []],
    ['844×340 iPhone se Safari', [281.333, 0, 425.333, 319], []],
    ['932×430 iPhone Pro Max', [265.333, 0, 545.333, 409], []],
    ['932×499 těsně pod hranicí', [169.333, 0, 665.333, 499], []],
    ['932×499 těsně pod hranicí s výřezem', [219, 0, 637.333, 478], []],
    [
      '390×844 iPhone 13–15 (výřez 47, lišta 34)',
      [8, 288.25, 374, 280.5],
      [
        [8, 738, 64, 64],
        [80, 738, 64, 64],
      ],
    ],
    [
      '390×664 iPhone v Safari s lištou',
      [8, 191.75, 374, 280.5],
      [
        [8, 592, 64, 64],
        [80, 592, 64, 64],
      ],
    ],
    [
      '360×780 Samsung s Chromem',
      [8, 261, 344, 258],
      [
        [4, 708, 64, 64],
        [76, 708, 64, 64],
      ],
    ],
    [
      '375×667 iPhone SE',
      [8, 198.875, 359, 269.25],
      [
        [8, 595, 64, 64],
        [80, 595, 64, 64],
      ],
    ],
    [
      '430×932 iPhone Pro Max (výřez 59, lišta 34)',
      [8, 323.25, 414, 310.5],
      [
        [8, 826, 64, 64],
        [80, 826, 64, 64],
      ],
    ],
    [
      '360×620 nejmenší telefon na výšku',
      [8, 181, 344, 258],
      [
        [4, 548, 64, 64],
        [76, 548, 64, 64],
      ],
    ],
    [
      '414×622 iPhone 8 Plus v Safari s lištami',
      [8, 161.75, 398, 298.5],
      [
        [8, 550, 64, 64],
        [80, 550, 64, 64],
      ],
    ],
    [
      '499×932 těsně pod hranicí šířky',
      [8, 284.875, 483, 362.25],
      [
        [8, 860, 64, 64],
        [80, 860, 64, 64],
      ],
    ],
    [
      '375×1180 úzký iPad (Split View)',
      [8, 455.375, 359, 269.25],
      [
        [8, 1108, 64, 64],
        [80, 1108, 64, 64],
      ],
    ],
    ['iPad na šířku z plochy (stavový řádek 24, lišta 20)', [116.667, 24, 1034.667, 776], []],
    [
      'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
      [8, 323.25, 414, 310.5],
      [
        [8, 826, 64, 64],
        [80, 826, 64, 64],
      ],
    ],
    [
      'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
      [8, 297.125, 377, 282.75],
      [
        [8, 746, 64, 64],
        [80, 746, 64, 64],
      ],
    ],
    ['iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)', [265.333, 0, 545.333, 409], []],
  ];
