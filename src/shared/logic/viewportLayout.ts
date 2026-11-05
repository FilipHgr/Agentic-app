/**
 * Herní plocha podle velikosti okna (#54, #56), společná pro všechny hry:
 * telefon na šířku i na výšku dostane plochu přes celou volnou plochu
 * okna, iPad dnešní plochu 1024 × 768 a ostatní okna dnešní zmenšené
 * zobrazení. Čistý TypeScript bez Phaseru.
 */

/** Herní jednotky na 1 CSS px na telefonu. */
export const PHONE_UNITS_PER_CSS_PX = 2;

// ---------------------------------------------------------------------------
// Okno a herní plocha
// ---------------------------------------------------------------------------

/** Telefon na šířku nebo na výšku, dnešní iPad, nebo dnešní zmenšené zobrazení. */
export type LayoutMode = 'tablet' | 'phoneLandscape' | 'phonePortrait' | 'scaled';

/** Výřez a lišta domů v CSS px (`env(safe-area-inset-*)`). */
export interface SafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Okno prohlížeče v CSS px. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly safeArea: SafeArea;
}

export interface GameSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Herní plocha: velikost v herních jednotkách, CSS px na jednotku
 * a levý horní roh v okně v CSS px.
 */
export interface GameArea extends GameSize {
  readonly mode: LayoutMode;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Dnešní herní plocha 4:3 (iPad na šířku). */
export const TABLET_GAME_WIDTH = 1024;
export const TABLET_GAME_HEIGHT = 768;

/** Okno na šířku aspoň takhle vysoké je iPad. */
const TABLET_MIN_WINDOW_HEIGHT = 500;

/** Nejmenší volná plocha (bez výřezu a lišty), kde se telefonní rozložení vejde. */
const PHONE_MIN_FREE_WIDTH = 744;
const PHONE_MIN_FREE_HEIGHT = 296;

/** Okno na výšku užší než 500 px je telefon (širší je iPad, #56). */
const PORTRAIT_PHONE_MAX_WINDOW_WIDTH = 500;
/** Nejmenší volná plocha na výšku, kde se rozložení P2 vejde (#56). */
const PORTRAIT_PHONE_MIN_FREE_WIDTH = 360;
const PORTRAIT_PHONE_MIN_FREE_HEIGHT = 620;

const NO_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

function isPositiveSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isInset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidSafeArea(safeArea: SafeArea | undefined): safeArea is SafeArea {
  return (
    safeArea !== undefined &&
    safeArea !== null &&
    [safeArea.top, safeArea.right, safeArea.bottom, safeArea.left].every(isInset)
  );
}

/** Má okno použitelnou velikost i výřez? Prohlížeč může na chvíli poslat nesmysl. */
export function isValidViewport(viewport: Viewport | undefined): viewport is Viewport {
  return (
    viewport !== undefined &&
    isPositiveSize(viewport.width) &&
    isPositiveSize(viewport.height) &&
    isValidSafeArea(viewport.safeArea)
  );
}

/** Volná plocha okna v CSS px: bez výřezu a lišty domů. */
function freeSizeOf(viewport: Viewport): GameSize {
  const { safeArea } = viewport;
  return {
    width: viewport.width - safeArea.left - safeArea.right,
    height: viewport.height - safeArea.top - safeArea.bottom,
  };
}

/**
 * Které rozložení okno dostane. Čtverec se bere jako okno na výšku.
 * O iPadu rozhoduje velikost celého okna, ne volné plochy (#54 AC5).
 */
export function chooseLayoutMode(viewport: Viewport | undefined): LayoutMode {
  if (!isValidViewport(viewport)) {
    return 'scaled';
  }
  if (viewport.width <= viewport.height) {
    return portraitLayoutMode(viewport);
  }
  if (viewport.height >= TABLET_MIN_WINDOW_HEIGHT) {
    return 'tablet';
  }
  const free = freeSizeOf(viewport);
  const phoneFits = free.width >= PHONE_MIN_FREE_WIDTH && free.height >= PHONE_MIN_FREE_HEIGHT;
  return phoneFits ? 'phoneLandscape' : 'scaled';
}

/**
 * Okno na výšku: telefon (užší než 500 px s dost velkou volnou plochou),
 * jinak dnešní zmenšené zobrazení. Úzký iPad ve Split View je záměrně
 * telefon, stejně jako u kolečka (#55).
 */
function portraitLayoutMode(viewport: Viewport): LayoutMode {
  const free = freeSizeOf(viewport);
  const phoneFits =
    viewport.width < PORTRAIT_PHONE_MAX_WINDOW_WIDTH &&
    free.width >= PORTRAIT_PHONE_MIN_FREE_WIDTH &&
    free.height >= PORTRAIT_PHONE_MIN_FREE_HEIGHT;
  return phoneFits ? 'phonePortrait' : 'scaled';
}

/** Je to telefonní rozložení (na šířku nebo na výšku) přes volnou plochu? */
export function isPhoneMode(mode: LayoutMode): mode is 'phoneLandscape' | 'phonePortrait' {
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

/** Telefon: herní plocha přesně přes volnou plochu, 2 jednotky na CSS px. */
function phoneGameArea(viewport: Viewport, mode: 'phoneLandscape' | 'phonePortrait'): GameArea {
  const free = freeSizeOf(viewport);
  return {
    mode,
    // Celé jednotky, aby plátno mělo celé pixely; ubere nejvýš čtvrt CSS px.
    width: Math.floor(free.width * PHONE_UNITS_PER_CSS_PX),
    height: Math.floor(free.height * PHONE_UNITS_PER_CSS_PX),
    scale: 1 / PHONE_UNITS_PER_CSS_PX,
    offsetX: viewport.safeArea.left,
    offsetY: viewport.safeArea.top,
  };
}

/** Dnešní zobrazení: 1024 × 768 celé v okně, co největší a na středu. */
function todayGameArea(mode: LayoutMode, window: GameSize): GameArea {
  const scale = Math.min(window.width / TABLET_GAME_WIDTH, window.height / TABLET_GAME_HEIGHT);
  return {
    mode,
    width: TABLET_GAME_WIDTH,
    height: TABLET_GAME_HEIGHT,
    scale,
    offsetX: (window.width - TABLET_GAME_WIDTH * scale) / 2,
    offsetY: (window.height - TABLET_GAME_HEIGHT * scale) / 2,
  };
}

/** Velikost okna; nesmyslný údaj se bere jako okno 0 × 0. */
function windowSizeOf(viewport: Viewport | undefined): GameSize {
  if (!viewport || !isPositiveSize(viewport.width) || !isPositiveSize(viewport.height)) {
    return { width: 0, height: 0 };
  }
  return { width: viewport.width, height: viewport.height };
}

/** Kam a jak velká se herní plocha v okně dá. */
export function gameAreaFor(viewport: Viewport | undefined): GameArea {
  const mode = chooseLayoutMode(viewport);
  if (isValidViewport(viewport) && isPhoneMode(mode)) {
    return phoneGameArea(viewport, mode);
  }
  return todayGameArea(mode, windowSizeOf(viewport));
}

/** Okno bez výřezu, když výřez chybí nebo je nesmyslný. */
export function safeAreaOrNone(safeArea: SafeArea | undefined): SafeArea {
  return isValidSafeArea(safeArea) ? safeArea : NO_SAFE_AREA;
}
