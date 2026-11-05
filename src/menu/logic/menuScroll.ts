/**
 * Posouvání jedním směrem (#69): mřížka her nebo kategorie v menu.
 * Posun 0 je začátek, `maxOffset` konec; dál se nedá posunout a na kraji
 * se posouvání zastaví bez pružení. Po rychlém tahu obsah krátce dojede
 * (setrvačnost) a nejpozději po `COAST_MAX_MS` stojí. Čistý TypeScript bez
 * Phaseru, čas dostává zvenku v ms.
 */

/** Pohyb prstu do této vzdálenosti (včetně) je ještě ťuknutí. */
export const DRAG_THRESHOLD_PX = 10;

/** Nejdelší dojíždění po puštění; musí skončit do 1 s (AC3). */
export const COAST_MAX_MS = 800;

/** Zpomalení při dojíždění v px/s². */
const COAST_DECELERATION = 3000;

/** Pomalejší tah po puštění nedojíždí. */
const COAST_MIN_SPEED = 150;

/** Dojíždění: rovnoměrné zpomalení ze `speed` na nulu za `durationMs`. */
interface Coast {
  readonly startOffset: number;
  /** Rychlost posunu v px/s (kladná = posun dál od začátku). */
  readonly speed: number;
  readonly startMs: number;
  readonly durationMs: number;
}

export interface Scroller {
  offset(): number;
  /** Nový konec posouvání (jiné rozložení); posun se případně zkrátí. */
  setMaxOffset(max: number): void;
  /** Skočí na posun (oříznutý do mezí) a zastaví dojíždění. */
  jumpTo(offset: number): void;
  /** Prst začal táhnout: dojíždění se zastaví, posun se počítá od teď. */
  startDrag(): void;
  /** Prst je o `distance` px od místa, kde se z dotyku stal tah (kladně = dolů / doprava). */
  dragTo(distance: number): void;
  /** Prst se zvedl rychlostí `fingerSpeed` px/s (kladně = dolů / doprava). */
  release(fingerSpeed: number, nowMs: number): void;
  /** Snímek: posune dojíždějící obsah. */
  step(nowMs: number): void;
  isCoasting(): boolean;
  stop(): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createScroller(): Scroller {
  let offset = 0;
  let max = 0;
  let dragStartOffset = 0;
  let coast: Coast | null = null;

  function setClamped(value: number): boolean {
    const clamped = clamp(value, 0, max);
    offset = clamped;
    return clamped !== value;
  }

  return {
    offset: () => offset,

    setMaxOffset(value: number): void {
      max = Math.max(0, value);
      if (setClamped(offset)) {
        coast = null;
      }
    },

    jumpTo(value: number): void {
      coast = null;
      setClamped(value);
    },

    startDrag(): void {
      coast = null;
      dragStartOffset = offset;
    },

    dragTo(distance: number): void {
      // Obsah jde za prstem: prst nahoru (záporně) posune obsah dál.
      setClamped(dragStartOffset - distance);
    },

    release(fingerSpeed: number, nowMs: number): void {
      const speed = -fingerSpeed;
      if (Math.abs(speed) < COAST_MIN_SPEED || max === 0) {
        coast = null;
        return;
      }
      const durationMs = Math.min(COAST_MAX_MS, (Math.abs(speed) / COAST_DECELERATION) * 1000);
      coast = { startOffset: offset, speed, startMs: nowMs, durationMs };
    },

    step(nowMs: number): void {
      if (coast === null) {
        return;
      }
      const elapsedMs = clamp(nowMs - coast.startMs, 0, coast.durationMs);
      const seconds = elapsedMs / 1000;
      const durationSeconds = coast.durationMs / 1000;
      // Rychlost klesá rovnoměrně k nule, takže obsah zastaví plynule.
      const travelled = coast.speed * (seconds - (seconds * seconds) / (2 * durationSeconds));
      const hitEdge = setClamped(coast.startOffset + travelled);
      if (hitEdge || elapsedMs >= coast.durationMs) {
        coast = null;
      }
    },

    isCoasting: () => coast !== null,

    stop(): void {
      coast = null;
    },
  };
}
