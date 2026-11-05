/**
 * Dotyky prstem v menu (#69): tažení posouvá mřížku her nebo kategorie,
 * ťuknutí vybere kategorii nebo spustí hru. Čistý TypeScript bez Phaseru;
 * scéna menu sem posílá dotyky v CSS px okna a jen kreslí posunutý obsah.
 *
 * - Ťuknutí platí až po zvednutí prstu, a jen když se prst od dotyku
 *   nepohnul o víc než `DRAG_THRESHOLD_PX`. Delší pohyb je tah: posouvá
 *   to, na čem začal (mřížku svisle, kategorie po směru jejich řady
 *   nebo sloupce), a nic nevybere ani nespustí. Posun se počítá od místa,
 *   kde prst práh překročil, takže obsah na začátku tahu neposkočí.
 * - Dlaždice nebo kategorie pod prstem je hned po dotyku zmáčknutá
 *   (`pressed()`), dokud se z dotyku nestane tah nebo se prst nezvedne.
 * - Posouvá jen první prst. Další prsty se ignorují, dokud se první nezvedne.
 * - Dotyk během dojíždění posouvání zastaví a nic nevybere ani nespustí.
 * - Po výběru jiné kategorie začne mřížka nahoře.
 * - Nové rozložení se stejnou mřížkou (návrat z hry, jiná kategorie)
 *   posun nechá. Jiné rozložení (otočení, změna okna) mřížku posune tak,
 *   aby byla vidět první dlaždice, která byla celá vidět předtím
 *   (u kategorií stejně).
 */

import type { Menu } from './menu';
import type { MenuBox, MenuLayout } from './menuLayout';
import { DRAG_THRESHOLD_PX, createScroller } from './menuScroll';
import type { Scroller } from './menuScroll';

/** Bod v CSS px okna. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export interface MenuTouchOptions {
  readonly menu: Menu;
}

export interface MenuTouch {
  /** Po každém překreslení menu: rozložení, podle kterého se posouvá a ťuká. */
  setLayout(layout: MenuLayout): void;
  pointerDown(pointerId: number, point: TouchPoint, nowMs: number): void;
  pointerMove(pointerId: number, point: TouchPoint, nowMs: number): void;
  pointerUp(pointerId: number, point: TouchPoint, nowMs: number): void;
  /** Systém dotyk zrušil: nic se nevybere ani nespustí. */
  pointerCancel(pointerId: number): void;
  /** Každý snímek: dojíždění posouvání. */
  frame(nowMs: number): void;
  /** O kolik px je mřížka posunutá nahoru. */
  gridOffset(): number;
  /** O kolik px jsou kategorie posunuté (v řadě doleva, ve sloupci nahoru). */
  categoryOffset(): number;
  /** Dlaždice nebo kategorie, která je právě zmáčknutá prstem, jinak `undefined`. */
  pressed(): PressedTarget | undefined;
}

/** Co může být zmáčknuté prstem. */
export type PressedTarget =
  | { readonly kind: 'tile'; readonly gameId: string }
  | { readonly kind: 'category'; readonly categoryId: string };

/** Jak dlouho zpátky se počítá rychlost prstu při puštění. */
const SPEED_WINDOW_MS = 100;

type Axis = 'x' | 'y';

type TapTarget =
  | { readonly kind: 'tile'; readonly gameId: string }
  | { readonly kind: 'category'; readonly categoryId: string }
  | { readonly kind: 'placeholder'; readonly index: number };

interface Sample {
  readonly timeMs: number;
  readonly position: number;
}

/** Dotyk prvního prstu. */
interface Gesture {
  readonly pointerId: number;
  readonly start: TouchPoint;
  readonly target: TapTarget | undefined;
  readonly scroller: Scroller | undefined;
  readonly axis: Axis;
  /** Kde prst překročil práh; od tohoto místa se počítá posun. */
  dragOrigin: TouchPoint | undefined;
  dragging: boolean;
  canTap: boolean;
  samples: Sample[];
}

function contains(box: MenuBox, point: TouchPoint): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function shifted(box: MenuBox, axis: Axis, offset: number): MenuBox {
  return axis === 'x'
    ? { ...box, left: box.left - offset, right: box.right - offset }
    : { ...box, top: box.top - offset, bottom: box.bottom - offset };
}

function startOf(box: MenuBox, axis: Axis): number {
  return axis === 'x' ? box.left : box.top;
}

/** Index prvního prvku, který je při posunu `offset` celý vidět, nebo -1. */
function firstFullyVisible(
  boxes: readonly MenuBox[],
  viewport: MenuBox,
  axis: Axis,
  offset: number,
): number {
  return boxes.findIndex((box) => {
    const moved = shifted(box, axis, offset);
    return axis === 'x'
      ? moved.left >= viewport.left && moved.right <= viewport.right
      : moved.top >= viewport.top && moved.bottom <= viewport.bottom;
  });
}

/** Rychlost prstu po ose v px/s za posledních `SPEED_WINDOW_MS`. */
function fingerSpeed(samples: readonly Sample[], nowMs: number): number {
  const recent = samples.filter((sample) => sample.timeMs >= nowMs - SPEED_WINDOW_MS);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === undefined || last === undefined || last.timeMs <= first.timeMs) {
    return 0;
  }
  return ((last.position - first.position) / (last.timeMs - first.timeMs)) * 1000;
}

/** Jedna posouvaná plocha: mřížka nebo kategorie. */
interface ScrollPart {
  readonly scroller: Scroller;
  axis: Axis;
  viewport: MenuBox | undefined;
  boxes: readonly MenuBox[];
  /** Podle tohoto klíče se pozná, že se rozložení plochy nezměnilo. */
  key: string;
}

function createPart(): ScrollPart {
  return { scroller: createScroller(), axis: 'y', viewport: undefined, boxes: [], key: '' };
}

/** Klíč rozložení plochy: viditelná plocha, směr a poloha a rozestup prvních dvou prvků. */
function partKey(axis: Axis, viewport: MenuBox, boxes: readonly MenuBox[]): string {
  return JSON.stringify([axis, viewport, boxes[0], boxes[1]]);
}

/**
 * Plocha dostane nové rozložení. Když se nezměnilo, posun zůstane;
 * jinak se posune tak, aby byl vidět první prvek, který byl předtím celý vidět.
 */
function updatePart(
  part: ScrollPart,
  axis: Axis,
  viewport: MenuBox,
  boxes: readonly MenuBox[],
  maxOffset: number,
): boolean {
  const key = partKey(axis, viewport, boxes);
  const changed = part.viewport !== undefined && key !== part.key;
  let anchorOffset: number | undefined;
  if (changed && part.viewport !== undefined) {
    const anchor = firstFullyVisible(part.boxes, part.viewport, part.axis, part.scroller.offset());
    const anchorBox = boxes[anchor];
    const firstBox = boxes[0];
    if (anchorBox !== undefined && firstBox !== undefined) {
      anchorOffset = startOf(anchorBox, axis) - startOf(firstBox, axis);
    }
  }
  part.axis = axis;
  part.viewport = viewport;
  part.boxes = boxes;
  part.key = key;
  part.scroller.setMaxOffset(maxOffset);
  if (changed) {
    part.scroller.jumpTo(anchorOffset ?? 0);
  }
  return changed;
}

export function createMenuTouch(options: MenuTouchOptions): MenuTouch {
  const { menu } = options;
  const grid = createPart();
  const categories = createPart();
  let layout: MenuLayout | undefined;
  let gesture: Gesture | null = null;

  function selectedCategoryId(): string | undefined {
    return menu.categories().find((category) => category.selected)?.id;
  }

  /** Co je pod prstem: posouvaná plocha a dlaždice, kategorie nebo zástupné tlačítko. */
  function findTarget(point: TouchPoint): { part?: ScrollPart; target?: TapTarget } {
    if (layout === undefined) {
      return {};
    }
    for (const part of [grid, categories]) {
      if (part.viewport === undefined || !contains(part.viewport, point)) {
        continue;
      }
      const offset = part.scroller.offset();
      const index = part.boxes.findIndex((box) => contains(shifted(box, part.axis, offset), point));
      if (part === grid) {
        const gameId = menu.tiles()[index]?.gameId;
        return { part, target: gameId === undefined ? undefined : { kind: 'tile', gameId } };
      }
      const categoryId = menu.categories()[index]?.id;
      return {
        part,
        target: categoryId === undefined ? undefined : { kind: 'category', categoryId },
      };
    }
    const index = layout.placeholders.findIndex((box) => contains(box, point));
    return index < 0 ? {} : { target: { kind: 'placeholder', index } };
  }

  function tap(target: TapTarget): void {
    switch (target.kind) {
      case 'tile':
        menu.tapTile(target.gameId);
        break;
      case 'category': {
        const before = selectedCategoryId();
        menu.tapCategory(target.categoryId);
        if (selectedCategoryId() !== before) {
          grid.scroller.jumpTo(0);
        }
        break;
      }
      case 'placeholder':
        menu.tapPlaceholder(target.index);
        break;
    }
  }

  function follow(current: Gesture, point: TouchPoint, nowMs: number): void {
    const dx = point.x - current.start.x;
    const dy = point.y - current.start.y;
    if (!current.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      current.dragging = true;
      current.canTap = false;
      current.dragOrigin = point;
      current.scroller?.startDrag();
    }
    current.samples.push({ timeMs: nowMs, position: current.axis === 'x' ? point.x : point.y });
    current.samples = current.samples.filter((sample) => sample.timeMs >= nowMs - SPEED_WINDOW_MS);
    const origin = current.dragOrigin;
    if (current.dragging && origin !== undefined) {
      current.scroller?.dragTo(current.axis === 'x' ? point.x - origin.x : point.y - origin.y);
    }
  }

  function isMoving(): boolean {
    return grid.scroller.isCoasting() || categories.scroller.isCoasting();
  }

  return {
    setLayout(next: MenuLayout): void {
      layout = next;
      const categoryAxis: Axis = next.categoryDirection === 'row' ? 'x' : 'y';
      const gridChanged = updatePart(
        grid,
        'y',
        next.gridScroll.viewport,
        next.tiles,
        next.gridScroll.maxOffset,
      );
      const categoriesChanged = updatePart(
        categories,
        categoryAxis,
        next.categoryScroll.viewport,
        next.categories.map((category) => category.hit),
        next.categoryScroll.maxOffset,
      );
      if (gridChanged || categoriesChanged) {
        // Pod prstem je teď něco jiného: rozběhnutý dotyk nic neudělá.
        gesture = null;
      }
    },

    pointerDown(pointerId: number, point: TouchPoint, nowMs: number): void {
      if (gesture !== null) {
        return;
      }
      const wasMoving = isMoving();
      grid.scroller.stop();
      categories.scroller.stop();
      const { part, target } = findTarget(point);
      gesture = {
        pointerId,
        start: point,
        target,
        scroller: part?.scroller,
        axis: part?.axis ?? 'y',
        dragOrigin: undefined,
        dragging: false,
        canTap: !wasMoving,
        samples: [{ timeMs: nowMs, position: part?.axis === 'x' ? point.x : point.y }],
      };
    },

    pointerMove(pointerId: number, point: TouchPoint, nowMs: number): void {
      if (gesture === null || gesture.pointerId !== pointerId) {
        return;
      }
      follow(gesture, point, nowMs);
    },

    pointerUp(pointerId: number, point: TouchPoint, nowMs: number): void {
      const current = gesture;
      if (current === null || current.pointerId !== pointerId) {
        return;
      }
      follow(current, point, nowMs);
      gesture = null;
      if (current.dragging) {
        current.scroller?.release(fingerSpeed(current.samples, nowMs), nowMs);
        return;
      }
      if (current.canTap && current.target !== undefined) {
        tap(current.target);
      }
    },

    pointerCancel(pointerId: number): void {
      if (gesture !== null && gesture.pointerId === pointerId) {
        gesture = null;
      }
    },

    frame(nowMs: number): void {
      grid.scroller.step(nowMs);
      categories.scroller.step(nowMs);
    },

    gridOffset: () => grid.scroller.offset(),
    categoryOffset: () => categories.scroller.offset(),

    pressed(): PressedTarget | undefined {
      if (gesture === null || !gesture.canTap || gesture.target?.kind === 'placeholder') {
        return undefined;
      }
      return gesture.target;
    },
  };
}
