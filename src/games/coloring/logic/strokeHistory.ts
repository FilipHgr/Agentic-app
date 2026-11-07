/**
 * Historie tahů pro tlačítko Zpět v Omalovánkách (#89). Úsporně pro
 * levnější tablet: krok historie drží jen nejmenší obdélník kolem pixelů,
 * které tah opravdu změnil, a jejich barvy před tahem, ne kopii celé
 * vrstvy. Během tahu si deník (`StrokeJournal`) poznamená každý pixel jen
 * při jeho první změně; tah, který nic nezměnil, nedá žádný krok.
 * Historie je jen v paměti a má nejvýš 20 kroků. Čistý TypeScript bez Phaseru.
 */

import type { ChangedArea } from './coloring';

/** Kolik posledních tahů jde vrátit (doporučení k otázce 1). */
export const UNDO_LIMIT = 20;

/** Jeden vratný tah: obdélník změněných pixelů a jejich barvy před tahem po řádcích. */
export interface StrokeChange {
  readonly area: ChangedArea;
  readonly previous: Uint8Array;
}

/** Počáteční místo deníku v pixelech; při větším tahu se zdvojnásobí. */
const INITIAL_JOURNAL_CAPACITY = 4096;

const BITS_PER_WORD = 32;

export interface StrokeJournal {
  /** Pixel `index` dostane novou barvu; `previous` je jeho barva před tím. */
  note(index: number, previous: number): void;
  /**
   * Ukončí tah: vrátí, co tah změnil, nebo `null`, když nic. Barvy mimo
   * poznamenané pixely vezme z vrstvy `layer`. Deník je pak prázdný.
   */
  finish(layer: Uint8Array): StrokeChange | null;
}

/** Deník jednoho tahu nad vrstvou `width` × `height`. */
export function createStrokeJournal(width: number, height: number): StrokeJournal {
  /** Které pixely už tah změnil (jeden bit na pixel). */
  const noted = new Uint32Array(Math.ceil((width * height) / BITS_PER_WORD));
  let indices = new Uint32Array(INITIAL_JOURNAL_CAPACITY);
  let previousColors = new Uint8Array(INITIAL_JOURNAL_CAPACITY);
  let count = 0;
  let bounds: { left: number; top: number; right: number; bottom: number } | null = null;

  const grow = (): void => {
    const biggerIndices = new Uint32Array(indices.length * 2);
    biggerIndices.set(indices);
    indices = biggerIndices;
    const biggerColors = new Uint8Array(previousColors.length * 2);
    biggerColors.set(previousColors);
    previousColors = biggerColors;
  };

  const widen = (x: number, y: number): void => {
    if (bounds === null) {
      bounds = { left: x, top: y, right: x + 1, bottom: y + 1 };
      return;
    }
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x + 1);
    bounds.bottom = Math.max(bounds.bottom, y + 1);
  };

  const clear = (): void => {
    for (let entry = 0; entry < count; entry += 1) {
      noted[Math.floor((indices[entry] ?? 0) / BITS_PER_WORD)] = 0;
    }
    count = 0;
    bounds = null;
    if (indices.length > INITIAL_JOURNAL_CAPACITY) {
      // Po velkém tahu se místo vrátí, ať deník paměť nedrží.
      indices = new Uint32Array(INITIAL_JOURNAL_CAPACITY);
      previousColors = new Uint8Array(INITIAL_JOURNAL_CAPACITY);
    }
  };

  return {
    note(index, previous) {
      const word = Math.floor(index / BITS_PER_WORD);
      const bit = 1 << (index % BITS_PER_WORD);
      const flags = noted[word] ?? 0;
      if ((flags & bit) !== 0) {
        return;
      }
      noted[word] = flags | bit;
      if (count === indices.length) {
        grow();
      }
      indices[count] = index;
      previousColors[count] = previous;
      count += 1;
      widen(index % width, Math.floor(index / width));
    },

    finish(layer) {
      const area: ChangedArea | null = bounds;
      if (area === null) {
        return null;
      }
      const areaWidth = area.right - area.left;
      const previous = new Uint8Array(areaWidth * (area.bottom - area.top));
      for (let y = area.top; y < area.bottom; y += 1) {
        const rowStart = y * width;
        previous.set(
          layer.subarray(rowStart + area.left, rowStart + area.right),
          (y - area.top) * areaWidth,
        );
      }
      for (let entry = 0; entry < count; entry += 1) {
        const index = indices[entry] ?? 0;
        const x = index % width;
        const y = Math.floor(index / width);
        previous[(y - area.top) * areaWidth + (x - area.left)] = previousColors[entry] ?? 0;
      }
      clear();
      return { area, previous };
    },
  };
}

export interface UndoHistory {
  /** Přidá vrácený tah; nejstarší nad limit zapomene. */
  push(change: StrokeChange): void;
  /** Vezme poslední tah k vrácení, nebo `null`, když není co vracet. */
  pop(): StrokeChange | null;
}

export function createUndoHistory(limit: number = UNDO_LIMIT): UndoHistory {
  const steps: StrokeChange[] = [];
  return {
    push(change) {
      steps.push(change);
      if (steps.length > limit) {
        steps.shift();
      }
    },
    pop: () => steps.pop() ?? null,
  };
}
