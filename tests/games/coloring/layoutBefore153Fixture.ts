/**
 * Pevné místo a velikost tlačítek alba a malování před #153 (commit
 * caa972b, sprint 4 po #152), v CSS px okna pro všechna okna
 * `COLORING_WINDOWS`: levý, horní, pravý a spodní okraj.
 *
 * Hlídá #153 AC4: „Tlačítka mají aspoň 64 × 64 px a jsou na stejném místě.“
 * #153 mění jen ikony a barvy podkladů, ne rozložení.
 *
 * Jak vznikly (jen pro představu, znovu se negenerují): jednorázový test
 * nad verzí hry před #153 vypsal `layoutColoring(area)` (fotoaparát
 * a koště), `layoutPicker(area)` (album, kniha) a `layoutBigPicture(area)`
 * (koš a malovat dál) převedené na CSS px, zaokrouhlené na tisíciny px.
 * Míry se nesmí přegenerovat z nové verze hry, jinak by test nic nehlídal.
 * Až úkol tlačítka záměrně přesune, upraví se tabulka v tom úkolu
 * s odkazem na něj.
 */

/** Obdélník v CSS px okna: levý, horní, pravý a spodní okraj. */
export type CssEdges = readonly [number, number, number, number];

export interface ActionButtonsBefore153 {
  /** Název okna z `COLORING_WINDOWS`. */
  readonly window: string;
  /** Fotoaparát v malování (#126). */
  readonly camera: CssEdges;
  /** Koště v malování (#142). */
  readonly broom: CssEdges;
  /** Album (kniha) na výběru omalovánky (#126). */
  readonly album: CssEdges;
  /** Koš na velkém obrázku z alba (#129). */
  readonly trash: CssEdges;
  /** Malovat dál na velkém obrázku z alba (#131). */
  readonly continueButton: CssEdges;
}

export const ACTION_BUTTONS_BEFORE_153: readonly ActionButtonsBefore153[] = [
  {
    window: 'iPad 1180×820',
    camera: [12, 432, 88, 508],
    broom: [12, 524, 88, 600],
    album: [1092, 12, 1168, 88],
    trash: [12, 432, 88, 508],
    continueButton: [12, 340, 88, 416],
  },
  {
    window: 'iPad 1180×760',
    camera: [12, 432, 88, 508],
    broom: [12, 524, 88, 600],
    album: [1092, 12, 1168, 88],
    trash: [12, 432, 88, 508],
    continueButton: [12, 340, 88, 416],
  },
  {
    window: '932×500 těsně nad hranicí',
    camera: [12, 412, 88, 488],
    broom: [104, 412, 180, 488],
    album: [844, 12, 920, 88],
    trash: [12, 412, 88, 488],
    continueButton: [12, 320, 88, 396],
  },
  {
    window: '744×296 nejmenší telefon',
    camera: [8, 224, 72, 288],
    broom: [88, 224, 152, 288],
    album: [672, 8, 736, 72],
    trash: [8, 224, 72, 288],
    continueButton: [8, 144, 72, 208],
  },
  {
    window: '800×300 Samsung s Chromem',
    camera: [8, 228, 72, 292],
    broom: [88, 228, 152, 292],
    album: [728, 8, 792, 72],
    trash: [8, 228, 72, 292],
    continueButton: [8, 148, 72, 212],
  },
  {
    window: '844×340 iPhone se Safari',
    camera: [55, 247, 119, 311],
    broom: [135, 247, 199, 311],
    album: [725, 8, 789, 72],
    trash: [55, 247, 119, 311],
    continueButton: [55, 167, 119, 231],
  },
  {
    window: '932×430 iPhone Pro Max',
    camera: [67, 337, 131, 401],
    broom: [147, 337, 211, 401],
    album: [801, 8, 865, 72],
    trash: [67, 337, 131, 401],
    continueButton: [67, 257, 131, 321],
  },
  {
    window: '932×499 těsně pod hranicí',
    camera: [8, 368, 72, 432],
    broom: [88, 368, 152, 432],
    album: [860, 8, 924, 72],
    trash: [8, 368, 72, 432],
    continueButton: [8, 288, 72, 352],
  },
  {
    window: '932×499 těsně pod hranicí s výřezem',
    camera: [67, 368, 131, 432],
    broom: [147, 368, 211, 432],
    album: [801, 8, 865, 72],
    trash: [67, 368, 131, 432],
    continueButton: [67, 288, 131, 352],
  },
  {
    window: '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    camera: [318, 55, 382, 119],
    broom: [238, 55, 302, 119],
    album: [318, 55, 382, 119],
    trash: [318, 55, 382, 119],
    continueButton: [238, 55, 302, 119],
  },
  {
    window: '390×664 iPhone v Safari s lištou',
    camera: [318, 8, 382, 72],
    broom: [238, 8, 302, 72],
    album: [318, 8, 382, 72],
    trash: [318, 8, 382, 72],
    continueButton: [238, 8, 302, 72],
  },
  {
    window: '360×780 Samsung s Chromem',
    camera: [288, 8, 352, 72],
    broom: [208, 8, 272, 72],
    album: [288, 8, 352, 72],
    trash: [288, 8, 352, 72],
    continueButton: [208, 8, 272, 72],
  },
  {
    window: '375×667 iPhone SE',
    camera: [303, 8, 367, 72],
    broom: [223, 8, 287, 72],
    album: [303, 8, 367, 72],
    trash: [303, 8, 367, 72],
    continueButton: [223, 8, 287, 72],
  },
  {
    window: '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    camera: [358, 67, 422, 131],
    broom: [278, 67, 342, 131],
    album: [358, 67, 422, 131],
    trash: [358, 67, 422, 131],
    continueButton: [278, 67, 342, 131],
  },
  {
    window: '360×620 nejmenší telefon na výšku',
    camera: [288, 8, 352, 72],
    broom: [208, 8, 272, 72],
    album: [288, 8, 352, 72],
    trash: [288, 8, 352, 72],
    continueButton: [208, 8, 272, 72],
  },
  {
    window: '414×622 iPhone 8 Plus v Safari s lištami',
    camera: [342, 8, 406, 72],
    broom: [262, 8, 326, 72],
    album: [342, 8, 406, 72],
    trash: [342, 8, 406, 72],
    continueButton: [262, 8, 326, 72],
  },
  {
    window: '499×932 těsně pod hranicí šířky',
    camera: [427, 8, 491, 72],
    broom: [347, 8, 411, 72],
    album: [427, 8, 491, 72],
    trash: [427, 8, 491, 72],
    continueButton: [347, 8, 411, 72],
  },
  {
    window: '375×1180 úzký iPad (Split View)',
    camera: [303, 8, 367, 72],
    broom: [223, 8, 287, 72],
    album: [303, 8, 367, 72],
    trash: [303, 8, 367, 72],
    continueButton: [223, 8, 287, 72],
  },
  {
    window: 'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    camera: [12, 456, 88, 532],
    broom: [12, 548, 88, 624],
    album: [1092, 36, 1168, 112],
    trash: [12, 456, 88, 532],
    continueButton: [12, 364, 88, 440],
  },
  {
    window: 'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    camera: [358, 67, 422, 131],
    broom: [278, 67, 342, 131],
    album: [358, 67, 422, 131],
    trash: [358, 67, 422, 131],
    continueButton: [278, 67, 342, 131],
  },
  {
    window: 'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    camera: [321, 67, 385, 131],
    broom: [241, 67, 305, 131],
    album: [321, 67, 385, 131],
    trash: [321, 67, 385, 131],
    continueButton: [241, 67, 305, 131],
  },
  {
    window: 'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    camera: [67, 337, 131, 401],
    broom: [147, 337, 211, 401],
    album: [801, 8, 865, 72],
    trash: [67, 337, 131, 401],
    continueButton: [67, 257, 131, 321],
  },
];
