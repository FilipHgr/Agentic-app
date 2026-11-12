/**
 * Jak se hýbe každý druh kousku prostředí na mapě postupu (#136): posun
 * středu, zvětšení, natočení a průhlednost v čase od ukázání mapy. Všechno
 * plyne jen z času a pořadí kousku (žádná náhoda, žádné rozložení), takže
 * po otočení zařízení pokračuje kousek ze stejného okamžiku (AC3).
 * Pohyby jsou pomalé a jemné, aby neodváděly pozornost od značky (AC5).
 *
 * Posun je v „jednotkách pohybu“, rozměry kousku v „jednotkách velikosti“;
 * obojí na herní jednotky převede rozložení (`mapScenery.ts`) podle místa,
 * které kousek na mapě dostal. Čistý TypeScript bez Phaseru.
 */

export type SceneryKind =
  | 'waves'
  | 'gull'
  | 'fallingLeaves'
  | 'butterfly'
  | 'flag'
  | 'cloud'
  | 'bubbles'
  | 'fish'
  | 'stars'
  | 'comet';

/** Kousek v jednom okamžiku, posun i rozměry ještě v jednotkách. */
export interface SceneryMotion {
  /** Posun středu v jednotkách pohybu. */
  readonly dx: number;
  readonly dy: number;
  /**
   * Posun středu v jednotkách velikosti: vlajka se otáčí kolem paty tyčky,
   * ne kolem svého středu, takže se při kývání posune i střed.
   */
  readonly shiftX: number;
  readonly shiftY: number;
  /** Zvětšení na šířku; záporné je kousek otočený zrcadlově (rybka plave doleva). */
  readonly scaleX: number;
  readonly scaleY: number;
  /** Natočení ve stupních (kladné po směru hodinových ručiček). */
  readonly angle: number;
  readonly alpha: number;
}

/** Rozsah pohybu druhu: kam se střed posune a jak velký kousek nejvýš bude. */
export interface SceneryMotionBounds {
  /** Šířka a výška kousku v jednotkách velikosti (díl průměru značky). */
  readonly width: number;
  readonly height: number;
  readonly dx: readonly [number, number];
  readonly dy: readonly [number, number];
  readonly shiftX: readonly [number, number];
  readonly shiftY: readonly [number, number];
  readonly maxScaleX: number;
  readonly maxScaleY: number;
  /** Největší natočení na obě strany ve stupních. */
  readonly maxAngle: number;
}

const FULL_TURN = Math.PI * 2;

/** Vlna −1 → 1 → −1 s periodou `periodMs`, posunutá o díl periody `phase`. */
function wave(elapsedMs: number, periodMs: number, phase: number): number {
  return Math.sin(FULL_TURN * (elapsedMs / periodMs + phase));
}

/** Díl cyklu 0 až 1 (bez 1) s periodou `periodMs`, posunutý o `phase`. */
function cycle(elapsedMs: number, periodMs: number, phase: number): number {
  const value = elapsedMs / periodMs + phase;
  return value - Math.floor(value);
}

/** Plynulé objevení na začátku a zmizení na konci cyklu (0 → 1 → 0). */
function fadeInOut(progress: number, edge: number): number {
  return Math.min(1, progress / edge, (1 - progress) / edge);
}

/** Hodnota mezi `min` a `max` podle vlny −1 až 1. */
function between(min: number, max: number, waveValue: number): number {
  return min + (max - min) * (0.5 + 0.5 * waveValue);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const STILL = {
  dx: 0,
  dy: 0,
  shiftX: 0,
  shiftY: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  alpha: 1,
} as const;

const NO_SHIFT = [0, 0] as const;

// Vlny u břehu: houpou se do stran a pomalu dýchají průhledností.
const WAVE_PERIOD_MS = 3800;
const WAVE_SWAY = 0.15;
const WAVE_BOB = 0.03;
const WAVE_PHASE_STEP = 0.37;
/** Dech je o čtvrt periody za houpáním. */
const WAVE_BREATH_LAG = 0.25;
const WAVE_ALPHA = { min: 0.6, max: 0.9 } as const;

function wavesAt(elapsedMs: number, index: number): SceneryMotion {
  const phase = index * WAVE_PHASE_STEP;
  const swing = wave(elapsedMs, WAVE_PERIOD_MS, phase);
  const breath = wave(elapsedMs, WAVE_PERIOD_MS, phase + WAVE_BREATH_LAG);
  return {
    ...STILL,
    dx: WAVE_SWAY * swing,
    dy: WAVE_BOB * swing * breath,
    alpha: between(WAVE_ALPHA.min, WAVE_ALPHA.max, breath),
  };
}

// Racek plachtí sem a tam, mírně se houpe a pomalu mává křídly.
const GULL_GLIDE_MS = 11000;
const GULL_BOB_MS = 2800;
const GULL_FLAP_MS = 1100;
const GULL_GLIDE = 1;
const GULL_BOB = 0.1;
const GULL_TILT = 5;
const GULL_PHASE_STEP = 0.5;
const GULL_FLAP_PHASE_STEP = 0.3;
const GULL_FLAP = { min: 0.5, max: 1 } as const;

function gullAt(elapsedMs: number, index: number): SceneryMotion {
  const bob = wave(elapsedMs, GULL_BOB_MS, index * GULL_PHASE_STEP);
  return {
    ...STILL,
    dx: GULL_GLIDE * wave(elapsedMs, GULL_GLIDE_MS, index * GULL_PHASE_STEP),
    dy: GULL_BOB * bob,
    scaleY: between(
      GULL_FLAP.min,
      GULL_FLAP.max,
      wave(elapsedMs, GULL_FLAP_MS, index * GULL_FLAP_PHASE_STEP),
    ),
    angle: GULL_TILT * bob,
  };
}

// Listí padá v pruhu shora dolů, kolébá se do stran a dole zmizí.
const LEAF_FALL_MS = 7500;
const LEAF_SWAY_MS = 2600;
const LEAF_FALL = 2.2;
const LEAF_SWAY = 0.22;
const LEAF_TILT = 28;
const LEAF_FALL_PHASE = { first: 0.15, step: 0.3 } as const;
const LEAF_SWAY_PHASE_STEP = 0.4;
/** List se naklání kousek za kolébáním. */
const LEAF_TILT_LAG = 0.1;
const LEAF_ALPHA = 0.95;
/** Jaký díl pádu list vybledá nahoře i dole. */
const LEAF_FADE = 0.12;

function fallingLeavesAt(elapsedMs: number, index: number): SceneryMotion {
  const fall = cycle(elapsedMs, LEAF_FALL_MS, LEAF_FALL_PHASE.first + index * LEAF_FALL_PHASE.step);
  const swayPhase = index * LEAF_SWAY_PHASE_STEP;
  return {
    ...STILL,
    dx: LEAF_SWAY * wave(elapsedMs, LEAF_SWAY_MS, swayPhase),
    dy: LEAF_FALL * fall,
    angle: LEAF_TILT * wave(elapsedMs, LEAF_SWAY_MS, swayPhase + LEAF_TILT_LAG),
    alpha: LEAF_ALPHA * fadeInOut(fall, LEAF_FADE),
  };
}

// Motýl létá v ležaté osmičce a pomalu mává křídly (zúžení na šířku).
const BUTTERFLY_PATH_MS = 8000;
const BUTTERFLY_FLAP_MS = 1100;
const BUTTERFLY_REACH = 0.6;
const BUTTERFLY_RISE = 0.22;
const BUTTERFLY_TILT = 10;
const BUTTERFLY_PHASE_STEP = 0.5;
const BUTTERFLY_FLAP_PHASE_STEP = 0.3;
const BUTTERFLY_FLAP = { min: 0.4, max: 1 } as const;

function butterflyAt(elapsedMs: number, index: number): SceneryMotion {
  const phase = index * BUTTERFLY_PHASE_STEP;
  const along = wave(elapsedMs, BUTTERFLY_PATH_MS, phase);
  const flap = Math.abs(wave(elapsedMs, BUTTERFLY_FLAP_MS, index * BUTTERFLY_FLAP_PHASE_STEP));
  return {
    ...STILL,
    dx: BUTTERFLY_REACH * along,
    // Nahoru a dolů dvakrát rychleji než do stran: ležatá osmička.
    dy: BUTTERFLY_RISE * wave(elapsedMs, BUTTERFLY_PATH_MS / 2, phase * 2),
    scaleX: BUTTERFLY_FLAP.min + (BUTTERFLY_FLAP.max - BUTTERFLY_FLAP.min) * flap,
    angle: BUTTERFLY_TILT * along,
  };
}

// Vlajka vlaje: praporek se natahuje a stahuje a tyčka se kývá kolem paty.
const FLAG_WAVE_MS = 1600;
const FLAG_TILT = 3;
const FLAG_WIDTH = 0.38;
const FLAG_HEIGHT = 0.4;
const FLAG_PHASE_STEP = 0.3;
const FLAG_TILT_LAG = 0.2;
const FLAG_STRETCH = { min: 0.76, max: 1 } as const;

function flagAt(elapsedMs: number, index: number): SceneryMotion {
  const phase = index * FLAG_PHASE_STEP;
  const scaleX = between(FLAG_STRETCH.min, FLAG_STRETCH.max, wave(elapsedMs, FLAG_WAVE_MS, phase));
  const angle = FLAG_TILT * wave(elapsedMs, FLAG_WAVE_MS, phase + FLAG_TILT_LAG);
  // Pata tyčky stojí: střed je od ní o půl (zúžené) šířky doprava a půl výšky nahoru, natočený.
  const radians = (angle * Math.PI) / 180;
  const halfWidth = (FLAG_WIDTH / 2) * scaleX;
  const halfHeight = FLAG_HEIGHT / 2;
  return {
    ...STILL,
    shiftX: halfWidth * Math.cos(radians) + halfHeight * Math.sin(radians) - FLAG_WIDTH / 2,
    shiftY: halfWidth * Math.sin(radians) - halfHeight * Math.cos(radians) + halfHeight,
    scaleX,
    angle,
  };
}

const FLAG_TILT_RADIANS = (FLAG_TILT * Math.PI) / 180;
const FLAG_HALF_HEIGHT = FLAG_HEIGHT / 2;
const FLAG_HALF_WIDEST = (FLAG_WIDTH / 2) * FLAG_STRETCH.max;
const FLAG_HALF_NARROWEST = (FLAG_WIDTH / 2) * FLAG_STRETCH.min;

// Mráček pomalu pluje sem a tam a jemně se vznáší.
const CLOUD_DRIFT_MS = 18000;
const CLOUD_FLOAT_MS = 5000;
const CLOUD_DRIFT = 0.9;
const CLOUD_FLOAT = 0.04;
const CLOUD_PHASE_STEP = 0.45;
const CLOUD_FLOAT_PHASE_STEP = 0.3;
const CLOUD_ALPHA = 0.92;

function cloudAt(elapsedMs: number, index: number): SceneryMotion {
  return {
    ...STILL,
    dx: CLOUD_DRIFT * wave(elapsedMs, CLOUD_DRIFT_MS, index * CLOUD_PHASE_STEP),
    dy: CLOUD_FLOAT * wave(elapsedMs, CLOUD_FLOAT_MS, index * CLOUD_FLOAT_PHASE_STEP),
    alpha: CLOUD_ALPHA,
  };
}

// Bublinka stoupá v pruhu zdola nahoru, kmitá do stran, roste a nahoře zmizí.
const BUBBLE_RISE_MS = 5600;
const BUBBLE_WOBBLE_MS = 1600;
const BUBBLE_RISE = 2;
const BUBBLE_WOBBLE = 0.08;
const BUBBLE_RISE_PHASE = { first: 0.1, step: 0.37 } as const;
const BUBBLE_WOBBLE_PHASE_STEP = 0.4;
/** Bublinka při stoupání naroste z `min` na `max`. */
const BUBBLE_GROWTH = { min: 0.8, max: 1.1 } as const;
const BUBBLE_ALPHA = 0.85;
const BUBBLE_FADE = 0.12;

function bubblesAt(elapsedMs: number, index: number): SceneryMotion {
  const rise = cycle(
    elapsedMs,
    BUBBLE_RISE_MS,
    BUBBLE_RISE_PHASE.first + index * BUBBLE_RISE_PHASE.step,
  );
  const grow = BUBBLE_GROWTH.min + (BUBBLE_GROWTH.max - BUBBLE_GROWTH.min) * rise;
  return {
    ...STILL,
    dx: BUBBLE_WOBBLE * wave(elapsedMs, BUBBLE_WOBBLE_MS, index * BUBBLE_WOBBLE_PHASE_STEP),
    dy: -BUBBLE_RISE * rise,
    scaleX: grow,
    scaleY: grow,
    alpha: BUBBLE_ALPHA * fadeInOut(rise, BUBBLE_FADE),
  };
}

// Rybka plave sem a tam, u kraje se plynule otočí a vlní se.
const FISH_SWIM_MS = 10000;
const FISH_WIGGLE_MS = 2200;
const FISH_SWIM = 0.9;
const FISH_BOB = 0.08;
const FISH_TILT = 4;
const FISH_PHASE = { first: 0.1, step: 0.37 } as const;
const FISH_WIGGLE_PHASE_STEP = 0.3;
const FISH_TURN_SHARPNESS = 4;
const FISH_THINNEST = 0.25;

function fishAt(elapsedMs: number, index: number): SceneryMotion {
  const phase = FISH_PHASE.first + index * FISH_PHASE.step;
  // Rybka míří tam, kam plave (cos je směr pohybu sinusového kmitu).
  const heading = clamp(
    FISH_TURN_SHARPNESS * Math.cos(FULL_TURN * (elapsedMs / FISH_SWIM_MS + phase)),
    -1,
    1,
  );
  const facing = heading >= 0 ? 1 : -1;
  const wiggle = wave(elapsedMs, FISH_WIGGLE_MS, index * FISH_WIGGLE_PHASE_STEP);
  return {
    ...STILL,
    dx: FISH_SWIM * wave(elapsedMs, FISH_SWIM_MS, phase),
    dy: FISH_BOB * wiggle,
    scaleX: facing * Math.max(FISH_THINNEST, Math.abs(heading)),
    angle: FISH_TILT * wiggle,
  };
}

// Hvězdy se třpytí: každá svým tempem jasní, roste a trochu se pootočí.
const STAR_TWINKLE_MS = [1900, 2300, 2700] as const;
const STAR_TILT = 12;
const STAR_PHASE_STEP = 0.23;
/** Natáčení je dvakrát pomalejší než třpyt. */
const STAR_TILT_SLOWER = 2;
const STAR_GROWTH = { min: 0.7, max: 1 } as const;
const STAR_ALPHA = { min: 0.35, max: 1 } as const;

function starsAt(elapsedMs: number, index: number): SceneryMotion {
  const period = STAR_TWINKLE_MS[index % STAR_TWINKLE_MS.length] ?? STAR_TWINKLE_MS[0];
  const phase = index * STAR_PHASE_STEP;
  const shine = wave(elapsedMs, period, phase);
  const grow = between(STAR_GROWTH.min, STAR_GROWTH.max, shine);
  return {
    ...STILL,
    scaleX: grow,
    scaleY: grow,
    angle: STAR_TILT * wave(elapsedMs, period * STAR_TILT_SLOWER, phase),
    alpha: between(STAR_ALPHA.min, STAR_ALPHA.max, shine),
  };
}

// Kometa proletí šikmo dolů doleva, zmizí a za chvíli letí znovu.
const COMET_CYCLE_MS = 7000;
const COMET_FLIGHT_SHARE = 0.7;
const COMET_FLIGHT = 1.6;
const COMET_PHASE = { first: 0.2, step: 0.5 } as const;
const COMET_ALPHA = 0.95;
const COMET_FADE = 0.2;
/** Natočení komety: hlava vlevo dole, ohon vpravo nahoře. */
const COMET_ANGLE = -20;
const COMET_DIRECTION = (COMET_ANGLE * Math.PI) / 180;
const COMET_REACH = COMET_FLIGHT / 2;

function cometAt(elapsedMs: number, index: number): SceneryMotion {
  const time = cycle(elapsedMs, COMET_CYCLE_MS, COMET_PHASE.first + index * COMET_PHASE.step);
  const flying = time < COMET_FLIGHT_SHARE;
  const flight = flying ? time / COMET_FLIGHT_SHARE : 1;
  const along = (flight - 0.5) * COMET_FLIGHT;
  return {
    ...STILL,
    dx: -Math.cos(COMET_DIRECTION) * along,
    dy: -Math.sin(COMET_DIRECTION) * along,
    angle: COMET_ANGLE,
    alpha: flying ? COMET_ALPHA * fadeInOut(flight, COMET_FADE) : 0,
  };
}

const COMET_REACH_X = Math.abs(Math.cos(COMET_DIRECTION)) * COMET_REACH;
const COMET_REACH_Y = Math.abs(Math.sin(COMET_DIRECTION)) * COMET_REACH;

/** Rozsah pohybu každého druhu; musí odpovídat funkcím pohybu výše. */
export const SCENERY_MOTION_BOUNDS: Readonly<Record<SceneryKind, SceneryMotionBounds>> = {
  waves: {
    width: 0.7,
    height: 0.2,
    dx: [-WAVE_SWAY, WAVE_SWAY],
    dy: [-WAVE_BOB, WAVE_BOB],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: 1,
    maxAngle: 0,
  },
  gull: {
    width: 0.5,
    height: 0.14,
    dx: [-GULL_GLIDE, GULL_GLIDE],
    dy: [-GULL_BOB, GULL_BOB],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: GULL_FLAP.max,
    maxAngle: GULL_TILT,
  },
  fallingLeaves: {
    width: 0.28,
    height: 0.18,
    dx: [-LEAF_SWAY, LEAF_SWAY],
    dy: [0, LEAF_FALL],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: 1,
    maxAngle: LEAF_TILT,
  },
  butterfly: {
    width: 0.42,
    height: 0.32,
    dx: [-BUTTERFLY_REACH, BUTTERFLY_REACH],
    dy: [-BUTTERFLY_RISE, BUTTERFLY_RISE],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: BUTTERFLY_FLAP.max,
    maxScaleY: 1,
    maxAngle: BUTTERFLY_TILT,
  },
  flag: {
    width: FLAG_WIDTH,
    height: FLAG_HEIGHT,
    dx: NO_SHIFT,
    dy: NO_SHIFT,
    // Posun středu se mění s natočením souvisle; krajní hodnoty jsou při největším natočení.
    shiftX: [
      FLAG_HALF_NARROWEST * Math.cos(FLAG_TILT_RADIANS) -
        FLAG_HALF_HEIGHT * Math.sin(FLAG_TILT_RADIANS) -
        FLAG_WIDTH / 2,
      FLAG_HALF_WIDEST + FLAG_HALF_HEIGHT * Math.sin(FLAG_TILT_RADIANS) - FLAG_WIDTH / 2,
    ],
    shiftY: [
      -FLAG_HALF_WIDEST * Math.sin(FLAG_TILT_RADIANS) -
        FLAG_HALF_HEIGHT * Math.cos(FLAG_TILT_RADIANS) +
        FLAG_HALF_HEIGHT,
      FLAG_HALF_WIDEST * Math.sin(FLAG_TILT_RADIANS) -
        FLAG_HALF_HEIGHT * Math.cos(FLAG_TILT_RADIANS) +
        FLAG_HALF_HEIGHT,
    ],
    maxScaleX: FLAG_STRETCH.max,
    maxScaleY: 1,
    maxAngle: FLAG_TILT,
  },
  cloud: {
    width: 0.8,
    height: 0.4,
    dx: [-CLOUD_DRIFT, CLOUD_DRIFT],
    dy: [-CLOUD_FLOAT, CLOUD_FLOAT],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: 1,
    maxAngle: 0,
  },
  bubbles: {
    width: 0.16,
    height: 0.16,
    dx: [-BUBBLE_WOBBLE, BUBBLE_WOBBLE],
    dy: [-BUBBLE_RISE, 0],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: BUBBLE_GROWTH.max,
    maxScaleY: BUBBLE_GROWTH.max,
    maxAngle: 0,
  },
  fish: {
    width: 0.44,
    height: 0.24,
    dx: [-FISH_SWIM, FISH_SWIM],
    dy: [-FISH_BOB, FISH_BOB],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: 1,
    maxAngle: FISH_TILT,
  },
  stars: {
    width: 0.24,
    height: 0.24,
    dx: NO_SHIFT,
    dy: NO_SHIFT,
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: STAR_GROWTH.max,
    maxScaleY: STAR_GROWTH.max,
    maxAngle: STAR_TILT,
  },
  comet: {
    width: 0.66,
    height: 0.2,
    dx: [-COMET_REACH_X, COMET_REACH_X],
    dy: [-COMET_REACH_Y, COMET_REACH_Y],
    shiftX: NO_SHIFT,
    shiftY: NO_SHIFT,
    maxScaleX: 1,
    maxScaleY: 1,
    maxAngle: Math.abs(COMET_ANGLE),
  },
};

const MOTIONS: Readonly<Record<SceneryKind, (elapsedMs: number, index: number) => SceneryMotion>> =
  {
    waves: wavesAt,
    gull: gullAt,
    fallingLeaves: fallingLeavesAt,
    butterfly: butterflyAt,
    flag: flagAt,
    cloud: cloudAt,
    bubbles: bubblesAt,
    fish: fishAt,
    stars: starsAt,
    comet: cometAt,
  };

/** Kousek `index` druhu `kind` v čase `elapsedMs` od ukázání mapy. */
export function sceneryMotionAt(
  kind: SceneryKind,
  index: number,
  elapsedMs: number,
): SceneryMotion {
  return MOTIONS[kind](Math.max(0, elapsedMs), index);
}
