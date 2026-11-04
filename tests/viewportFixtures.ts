/**
 * Zkušební okna a pomůcky pro testy rozložení podle velikosti okna (#54).
 * Rozměry okna a výřezu jsou v CSS px (px na skutečném displeji).
 */

export interface TestSafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface TestWindow {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: TestSafeArea;
}

export const NO_NOTCH: TestSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/** iPhone 13–15 na šířku: výřez 47 px vlevo i vpravo, lišta domů 21 px dole. */
const IPHONE_NOTCH: TestSafeArea = { top: 0, right: 47, bottom: 21, left: 47 };

/** iPhone Pro Max na šířku: výřez 59 px vlevo i vpravo, lišta domů 21 px dole. */
const IPHONE_PRO_MAX_NOTCH: TestSafeArea = { top: 0, right: 59, bottom: 21, left: 59 };

/** Nejmenší okno, které ještě dostane telefonní rozložení (rezerva 0 px). */
export const SMALLEST_PHONE: TestWindow = {
  name: '744×296 nejmenší telefon',
  width: 744,
  height: 296,
  safeArea: NO_NOTCH,
};

/** Zkušební okna telefonu na šířku z #54 a okno těsně pod hranicí 500 px. */
export const PHONE_WINDOWS: readonly TestWindow[] = [
  SMALLEST_PHONE,
  { name: '800×300 Samsung s Chromem', width: 800, height: 300, safeArea: NO_NOTCH },
  { name: '844×340 iPhone se Safari', width: 844, height: 340, safeArea: IPHONE_NOTCH },
  { name: '932×430 iPhone Pro Max', width: 932, height: 430, safeArea: IPHONE_PRO_MAX_NOTCH },
  { name: '932×499 těsně pod hranicí', width: 932, height: 499, safeArea: NO_NOTCH },
  {
    name: '932×499 těsně pod hranicí s výřezem',
    width: 932,
    height: 499,
    safeArea: IPHONE_PRO_MAX_NOTCH,
  },
];

/** iPad na šířku, jehož rozložení se nesmí změnit (AC5). */
export const IPAD_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad 1180×820', width: 1180, height: 820, safeArea: NO_NOTCH },
  { name: 'iPad 1180×760', width: 1180, height: 760, safeArea: NO_NOTCH },
];

/** Okno těsně nad hranicí: už dnešní rozložení iPadu. */
export const JUST_ABOVE_LIMIT: TestWindow = {
  name: '932×500 těsně nad hranicí',
  width: 932,
  height: 500,
  safeArea: NO_NOTCH,
};

/** Údaje o okně tak, jak je hra dostane od prohlížeče. */
export function viewportOf(window: TestWindow): {
  width: number;
  height: number;
  safeArea: TestSafeArea;
} {
  return { width: window.width, height: window.height, safeArea: window.safeArea };
}

export interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Obdélník se středem v `x`, `y`. */
export function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

/** Překrývají se (dotyk hranou se nepočítá)? */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Je `inner` celý uvnitř `outer` (s tolerancí na zaokrouhlení)? */
export function isInside(inner: Box, outer: Box, tolerance = 0.01): boolean {
  return (
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance
  );
}

/** Mezera mezi dvěma obdélníky: větší z vodorovné a svislé (záporná = překryv). */
export function gapBetween(a: Box, b: Box): number {
  const horizontal = Math.max(b.left - a.right, a.left - b.right);
  const vertical = Math.max(b.top - a.bottom, a.top - b.bottom);
  return Math.max(horizontal, vertical);
}

export function boundsOf(boxes: readonly Box[]): Box {
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

export function widthOf(b: Box): number {
  return b.right - b.left;
}

export function heightOf(b: Box): number {
  return b.bottom - b.top;
}

/** Volná plocha okna: bez výřezu a lišty domů. */
export function freeAreaOf(window: TestWindow): Box {
  const { safeArea } = window;
  return {
    left: safeArea.left,
    right: window.width - safeArea.right,
    top: safeArea.top,
    bottom: window.height - safeArea.bottom,
  };
}

/** Strana volného rohu vpravo nahoře, kde je kolečko nastavení (AC2). */
export const GEAR_CORNER_SIZE = 88;

/** Pravý horní roh volné plochy 88 × 88 CSS px. */
export function gearCornerOf(window: TestWindow): Box {
  const free = freeAreaOf(window);
  return {
    left: free.right - GEAR_CORNER_SIZE,
    right: free.right,
    top: free.top,
    bottom: free.top + GEAR_CORNER_SIZE,
  };
}

/** Jak je herní plocha umístěná v okně: levý horní roh v CSS px a CSS px na herní jednotku. */
export interface Placement {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Obdélník v herních jednotkách přepočtený na CSS px v okně. */
export function toCss(b: Box, placement: Placement): Box {
  return {
    left: placement.offsetX + b.left * placement.scale,
    right: placement.offsetX + b.right * placement.scale,
    top: placement.offsetY + b.top * placement.scale,
    bottom: placement.offsetY + b.bottom * placement.scale,
  };
}

/** Dnešní zobrazení: plocha 1024 × 768 zmenšená na celé okno (Phaser Scale.FIT, na střed). */
export const TODAY_GAME_WIDTH = 1024;
export const TODAY_GAME_HEIGHT = 768;

export function todayFitPlacement(windowWidth: number, windowHeight: number): Placement {
  const scale = Math.min(windowWidth / TODAY_GAME_WIDTH, windowHeight / TODAY_GAME_HEIGHT);
  return {
    scale,
    offsetX: (windowWidth - TODAY_GAME_WIDTH * scale) / 2,
    offsetY: (windowHeight - TODAY_GAME_HEIGHT * scale) / 2,
  };
}
