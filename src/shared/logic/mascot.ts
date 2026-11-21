/**
 * Logika sdílené pandy (#166) bez Phaseru: který snímek kterého pohybu je
 * v daném čase vidět, kdy se pohyb stáhne a kdy uvolní z paměti, a kam
 * se panda postaví v obdélníku od hry.
 *
 * Pohyb je arch 37 snímků (12 snímků/s) v mřížce 6 sloupců, snímek
 * 363 × 360 px. Všechny pohyby mají společný výřez, panda je ve všech na
 * stejném místě. Klid (`idle`) se opakuje dokola, ostatní pohyby se
 * přehrají jednou a panda se vrátí do klidu.
 *
 * Stahování a paměť řídí model příkazy (`MascotCommand`): pohled je jen
 * vykoná (stáhne nebo uvolní texturu) a zpátky ohlásí dočtení (`loaded`)
 * nebo chybu (`failed`). Čas (ms) dává volající, model sám čas nečte.
 */

/** Pohyby pandy; klid je první a je vždy v paměti. */
export const MASCOT_MOVES = ['idle', 'wave', 'joy', 'encourage', 'think', 'celebrate'] as const;
export type MascotMove = (typeof MASCOT_MOVES)[number];

/** Rozměr jednoho snímku v archu (px). */
export const MASCOT_FRAME_SIZE = { width: 363, height: 360 } as const;
/** Počet sloupců mřížky snímků v archu. */
export const MASCOT_SHEET_COLUMNS = 6;
/** Počet snímků v každém pohybu. */
export const MASCOT_FRAME_COUNT = 37;
export const MASCOT_FRAMES_PER_SECOND = 12;
/** Kolik pohybů kromě klidu smí být najednou dekódovaných (AC4). */
export const MAX_DECODED_MOVES = 3;

const IDLE: MascotMove = 'idle';
const FRAME_MS = 1000 / MASCOT_FRAMES_PER_SECOND;

/** Jak dlouho trvá jedno přehrání pohybu (ms). */
export function moveDurationMs(): number {
  return MASCOT_FRAME_COUNT * FRAME_MS;
}

/** Snímek pandy: pohyb a pořadí snímku od 0. */
export interface MascotFrame {
  readonly move: MascotMove;
  readonly frame: number;
}

/** Co má pohled udělat: stáhnout pohyb, nebo uvolnit jeho texturu. */
export interface MascotCommand {
  readonly type: 'download' | 'release';
  readonly move: MascotMove;
}

export interface MascotModel {
  /** Hra pandu použila (vytvořila pohled): stáhne se klid, pokud ještě není. */
  use(): MascotCommand[];
  /** Pohyb se stáhne dopředu, aby se dal přehrát hned při vyžádání. */
  prepare(move: MascotMove): MascotCommand[];
  /** Hra chce pohyb: načtený začne od 1. snímku, nenačtený nechá pandu v klidu a stáhne se. */
  play(move: MascotMove, now: number): MascotCommand[];
  /**
   * Pohyb už nebude potřeba (třeba vynechaný pozdrav, #167): stažený se
   * uvolní hned, stahovaný po dočtení. Klid a právě hraný pohyb zůstanou.
   */
  discard(move: MascotMove): MascotCommand[];
  /** Pohled ohlásil, že je pohyb stažený a dekódovaný. Sám se nepřehraje. */
  loaded(move: MascotMove): MascotCommand[];
  /** Pohled ohlásil chybu stažení; příští vyžádání stažení zkusí znovu. */
  failed(move: MascotMove): void;
  /** Posun času: dohraný pohyb se vrátí do klidu, dohraný pozdrav se uvolní. */
  update(now: number): MascotCommand[];
  /** Je pohyb stažený a dekódovaný (přehraje se hned)? */
  isLoaded(move: MascotMove): boolean;
  /** Který pohyb panda v čase `now` hraje. */
  currentMove(now: number): MascotMove;
  /** Snímek v čase `now`, nebo `null`, dokud není načtený klid (panda není vidět). */
  frame(now: number): MascotFrame | null;
  /** Konec pandy: uvolní všechno, co je v paměti. */
  dispose(): MascotCommand[];
}

type LoadState = 'none' | 'loading' | 'loaded' | 'failed';

interface Playing {
  readonly move: MascotMove;
  readonly startedAt: number;
}

/** Kolik ms uběhlo od začátku pohybu; neplatný nebo záporný čas je 0. */
function elapsedSince(startedAt: number, now: number): number {
  const elapsed = now - startedAt;
  if (Number.isNaN(elapsed) || elapsed <= 0) {
    return 0;
  }
  return elapsed;
}

/** Pořadí snímku po `elapsed` ms opakovaného klidu. */
function loopFrame(elapsed: number): number {
  if (!Number.isFinite(elapsed)) {
    return 0;
  }
  return Math.floor(elapsed / FRAME_MS) % MASCOT_FRAME_COUNT;
}

/** Snímek přehrávání v čase `now`; po konci jednorázového pohybu běží klid. */
function frameOf(playing: Playing, now: number): MascotFrame {
  const elapsed = elapsedSince(playing.startedAt, now);
  if (playing.move === IDLE) {
    return { move: IDLE, frame: loopFrame(elapsed) };
  }
  const frame = Math.floor(elapsed / FRAME_MS);
  if (frame < MASCOT_FRAME_COUNT) {
    return { move: playing.move, frame };
  }
  return { move: IDLE, frame: loopFrame(elapsed - moveDurationMs()) };
}

function download(move: MascotMove): MascotCommand {
  return { type: 'download', move };
}

function release(move: MascotMove): MascotCommand {
  return { type: 'release', move };
}

export function createMascotModel(): MascotModel {
  const loads = new Map<MascotMove, LoadState>();
  /** Kdy byl pohyb naposledy použit (pořadí, ne čas), pro uvolňování kvůli místu. */
  const lastUse = new Map<MascotMove, number>();
  let useCounter = 0;
  /** Stahované pohyby, které se po dočtení hned uvolní (`discard`). */
  const discarded = new Set<MascotMove>();
  let playing: Playing = { move: IDLE, startedAt: 0 };
  let disposed = false;

  const stateOf = (move: MascotMove): LoadState => loads.get(move) ?? 'none';

  function touch(move: MascotMove): void {
    useCounter += 1;
    lastUse.set(move, useCounter);
  }

  /** Stáhne pohyb, pokud není stažený ani se nestahuje (i po chybě). */
  function downloadIfNeeded(move: MascotMove): MascotCommand[] {
    const state = stateOf(move);
    // Znovu vyžádaný pohyb se po dočtení neuvolní.
    discarded.delete(move);
    if (disposed || state === 'loading' || state === 'loaded') {
      return [];
    }
    loads.set(move, 'loading');
    return [download(move)];
  }

  function releaseMove(move: MascotMove): MascotCommand {
    loads.set(move, 'none');
    lastUse.delete(move);
    return release(move);
  }

  /** Přepne přehrávání; z opuštěného pozdravu se stane příkaz k uvolnění. */
  function switchTo(next: Playing): MascotCommand[] {
    const left = playing.move;
    playing = next;
    if (left === 'wave' && next.move !== 'wave' && stateOf('wave') === 'loaded') {
      return [releaseMove('wave')];
    }
    return [];
  }

  /** Pohyby kromě klidu v paměti, které se smí uvolnit, od nejdéle nepoužitého. */
  function evictionCandidates(keep: MascotMove): MascotMove[] {
    return MASCOT_MOVES.filter(
      (move) =>
        move !== IDLE && move !== keep && move !== playing.move && stateOf(move) === 'loaded',
    ).sort((first, second) => (lastUse.get(first) ?? 0) - (lastUse.get(second) ?? 0));
  }

  function decodedCount(): number {
    return MASCOT_MOVES.filter((move) => move !== IDLE && stateOf(move) === 'loaded').length;
  }

  /** Uvolní nejdéle nepoužité pohyby, dokud jich kromě klidu není nejvýš 3. */
  function makeRoom(keep: MascotMove): MascotCommand[] {
    const commands: MascotCommand[] = [];
    for (const move of evictionCandidates(keep)) {
      if (decodedCount() <= MAX_DECODED_MOVES) {
        break;
      }
      commands.push(releaseMove(move));
    }
    return commands;
  }

  /** Dohraný jednorázový pohyb přejde do klidu, který navazuje na jeho konec. */
  function settle(now: number): MascotCommand[] {
    if (playing.move === IDLE) {
      return [];
    }
    if (elapsedSince(playing.startedAt, now) < moveDurationMs()) {
      return [];
    }
    return switchTo({ move: IDLE, startedAt: playing.startedAt + moveDurationMs() });
  }

  return {
    use: () => downloadIfNeeded(IDLE),

    prepare: (move) => downloadIfNeeded(move),

    play(move, now) {
      if (disposed) {
        return [];
      }
      if (stateOf(move) === 'loaded') {
        touch(move);
        return switchTo({ move, startedAt: now });
      }
      const commands = downloadIfNeeded(move);
      if (playing.move === IDLE) {
        return commands;
      }
      return [...commands, ...switchTo({ move: IDLE, startedAt: now })];
    },

    discard(move) {
      if (disposed || move === IDLE || move === playing.move) {
        return [];
      }
      const state = stateOf(move);
      if (state === 'loading') {
        discarded.add(move);
        return [];
      }
      return state === 'loaded' ? [releaseMove(move)] : [];
    },

    loaded(move) {
      if (disposed) {
        return [release(move)];
      }
      if (discarded.delete(move)) {
        loads.set(move, 'none');
        return [release(move)];
      }
      loads.set(move, 'loaded');
      touch(move);
      return move === IDLE ? [] : makeRoom(move);
    },

    failed(move) {
      if (!disposed) {
        loads.set(move, 'failed');
      }
    },

    update: (now) => (disposed ? [] : settle(now)),

    isLoaded: (move) => !disposed && stateOf(move) === 'loaded',

    currentMove: (now) => frameOf(playing, now).move,

    frame(now) {
      if (disposed || stateOf(IDLE) !== 'loaded') {
        return null;
      }
      return frameOf(playing, now);
    },

    dispose() {
      const commands = MASCOT_MOVES.filter((move) => stateOf(move) === 'loaded').map(releaseMove);
      disposed = true;
      return commands;
    },
  };
}

/** Obdélník, do kterého hra pandu postaví (CSS px nebo body plátna). */
export interface MascotArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Umístění pandy: `x`, `y` je bod pod nohama (dole uprostřed snímku),
 * `scale` zvětšení snímku a `width`, `height` výsledná velikost.
 */
export interface MascotPlacement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}

function isUsableSide(side: number): boolean {
  return Number.isFinite(side) && side > 0;
}

/** Panda co největší v obdélníku se zachovaným poměrem stran, nohy dole uprostřed. */
export function placeMascot(area: MascotArea): MascotPlacement {
  const x = area.x + area.width / 2;
  const y = area.y + area.height;
  if (!isUsableSide(area.width) || !isUsableSide(area.height)) {
    return { x, y, scale: 0, width: 0, height: 0 };
  }
  const scale = Math.min(
    area.width / MASCOT_FRAME_SIZE.width,
    area.height / MASCOT_FRAME_SIZE.height,
  );
  return {
    x,
    y,
    scale,
    width: MASCOT_FRAME_SIZE.width * scale,
    height: MASCOT_FRAME_SIZE.height * scale,
  };
}
