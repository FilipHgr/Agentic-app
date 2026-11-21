/**
 * Kde v menu stojí panda (#168). Čistý TypeScript bez Phaseru.
 *
 * Panda je ozdoba: nic v menu kvůli ní neustoupí ani se nezmenší (AC2).
 * Stojí jen ve volné části posouvané plochy her, pod blokem dlaždic nebo
 * vedle něj, a jen když se mřížka neposouvá (AC1). Od dlaždic má aspoň
 * 8 px, od okraje viditelné plochy mřížky 4 px (od lišty a kategorií tak
 * 8 px jako ostatní ťukací plochy) a je vysoká aspoň 96 px, nejvýš 180 px
 * jako v Počítání. Jinak není vidět.
 *
 * Místo se počítá z bloku dlaždic všech her („Vše“): blok vybrané
 * kategorie je jen znovu vystředěný a menší (#156), leží uvnitř bloku
 * „Vše“, takže panda po výběru kategorie nikam neuhýbá.
 *
 * Ze tří míst (pod blokem, vlevo a vpravo od něj) vyhraje to, kde je panda
 * nejvyšší, při shodě v tomhle pořadí. Pod blokem panda stojí uprostřed
 * pod ním na spodním okraji místa, vedle bloku uprostřed místa nohama
 * u spodního okraje bloku.
 */

import {
  MASCOT_FRAME_SIZE,
  MASCOT_MAX_HEIGHT_CSS_PX,
  MASCOT_MIN_HEIGHT_CSS_PX,
} from '../../shared/logic/mascot';
import type { MenuBox, MenuScrollArea } from './menuLayout';

/** Odstup pandy od dlaždic v CSS px (AC1). */
export const MASCOT_TILE_GAP_CSS_PX = 8;

/**
 * Odstup pandy od okraje viditelné plochy mřížky v CSS px. Viditelná
 * plocha je od lišty a kategorií 4 px, panda je od nich 8 px.
 */
export const MASCOT_VIEWPORT_INSET_CSS_PX = 4;

const MASCOT_ASPECT = MASCOT_FRAME_SIZE.width / MASCOT_FRAME_SIZE.height;

/** Volné místo a kam v něm panda postaví nohy. */
interface Spot {
  readonly room: MenuBox;
  /** Vodorovný střed pandy (posune se, aby byla celá v místě). */
  readonly centerX: number;
}

function boundsOf(boxes: readonly MenuBox[]): MenuBox {
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

function inset(box: MenuBox, by: number): MenuBox {
  return { left: box.left + by, right: box.right - by, top: box.top + by, bottom: box.bottom - by };
}

/** Místa pod blokem dlaždic a vlevo a vpravo od něj (vedle bloku jen v jeho výšce). */
function spotsAround(area: MenuBox, block: MenuBox): Spot[] {
  const gap = MASCOT_TILE_GAP_CSS_PX;
  const below: MenuBox = { ...area, top: block.bottom + gap };
  const left: MenuBox = { ...area, right: block.left - gap, top: block.top, bottom: block.bottom };
  const right: MenuBox = { ...area, left: block.right + gap, top: block.top, bottom: block.bottom };
  return [
    { room: below, centerX: (block.left + block.right) / 2 },
    { room: left, centerX: (left.left + left.right) / 2 },
    { room: right, centerX: (right.left + right.right) / 2 },
  ];
}

/** Výška pandy v místě: co největší se zachovaným poměrem stran, nejvýš 180 px. */
function pandaHeightIn(room: MenuBox): number {
  const height = Math.min(room.bottom - room.top, (room.right - room.left) / MASCOT_ASPECT);
  return Math.min(Math.max(0, height), MASCOT_MAX_HEIGHT_CSS_PX);
}

/** Panda výšky `height` v místě: nohy na spodním okraji, střed co nejblíž `centerX`. */
function pandaIn(spot: Spot, height: number): MenuBox {
  const width = height * MASCOT_ASPECT;
  const { room } = spot;
  const left = Math.min(Math.max(spot.centerX - width / 2, room.left), room.right - width);
  return { left, right: left + width, top: room.bottom - height, bottom: room.bottom };
}

/**
 * Obdélník pandy (snímek i ťukací plocha) v CSS px okna, nebo `null`, když
 * panda nemá být vidět. `grid` je posouvaná plocha her, `allTiles`
 * dlaždice všech her („Vše“) v CSS px okna bez posunu.
 */
export function menuMascotBox(grid: MenuScrollArea, allTiles: readonly MenuBox[]): MenuBox | null {
  if (grid.maxOffset > 0 || allTiles.length === 0) {
    return null;
  }
  const area = inset(grid.viewport, MASCOT_VIEWPORT_INSET_CSS_PX);
  let best: { spot: Spot; height: number } | null = null;
  for (const spot of spotsAround(area, boundsOf(allTiles))) {
    const height = pandaHeightIn(spot.room);
    if (best === null || height > best.height) {
      best = { spot, height };
    }
  }
  if (best === null || best.height < MASCOT_MIN_HEIGHT_CSS_PX) {
    return null;
  }
  return pandaIn(best.spot, best.height);
}
