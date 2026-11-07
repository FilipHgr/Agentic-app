/**
 * Rozmalovaný obrázek Omalovánek v úložišti profilu (#92). Obrázek se
 * uloží synchronně po každém dokončeném tahu, po ťuknutí na barvu
 * (pamatuje se naposledy vybraná barva i bez tahu) a při odchodu nebo
 * schování stránky (`suspend`), kdy se rozpracovaný tah ukončí tam, kam
 * prst došel.
 *
 * Záznam je text: hlavička (formát, omalovánka, verze, rozměr, vybraná
 * barva), vrstva barev zakódovaná v `colorLayerCode.ts` a kontrolní
 * součet celého zbytku. Záznam delší než limit se neuloží.
 *
 * Chybějící, poškozený, nečitelný nebo cizí záznam (jiná verze nebo
 * rozměr) dá prázdnou omalovánku a první barvu (AC4). Selhání úložiště
 * hra nikdy nevyhodí (AC5); co se nepodaří uložit, drží v paměti úložiště
 * profilu (`gameStorage`) do zavření stránky.
 *
 * Zpět (#89) vrací tahy z historie v paměti (`strokeHistory.ts`), vrácený
 * stav se uloží stejně jako po tahu. Panel nástrojů (#96) se otevírá
 * úchytem a zavře se i tahem po obrázku; při prvním otevření hry v profilu
 * začíná otevřený (`toolPanel.ts`).
 *
 * Vybraný nástroj (štětec nebo guma, #90) je jen v paměti: po otevření hry
 * je vždy štětec, výběr barvy přepne zpátky na štětec. Ťuknutí na nástroj,
 * barvu, úchyt nebo Zpět druhým prstem během tahu se nepočítá (AC3).
 * Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { Tone } from '../../../shared/audio/tonePlayer';
import { HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import { NO_COLOR, createColoring, emptyColorLayer } from './coloring';
import type { ChangedArea, PointerSample } from './coloring';
import { PALETTE, initialPalette, tapColor } from './palette';
import type { PaletteState } from './palette';
import { decodeColorLayer, encodeColorLayer } from './colorLayerCode';
import type { RegionMap } from './regionMap';
import { createUndoHistory } from './strokeHistory';
import {
  INITIAL_TOOL,
  PANEL_CLOSE_TONES,
  PANEL_OPEN_TONES,
  TOOL_PICK_TONES,
  rememberOpened,
  toolAtSlot,
  wasOpenedBefore,
} from './toolPanel';
import type { HandleView, ToolId } from './toolPanel';

/** Nejdelší záznam jedné omalovánky ve znacích (AC6). */
export const PICTURE_RECORD_LIMIT = 50_000;

/** Označení formátu záznamu; při změně kódování se zvýší. */
const RECORD_FORMAT = 'p1';

const FIELD_SEPARATOR = '|';

/** Kolik polí má záznam: formát, id, verze, šířka, výška, barva, data, součet. */
const RECORD_FIELD_COUNT = 8;

/** Která omalovánka a v jaké verzi obrysu; při změně obrysu se verze zvýší. */
export interface PictureIdentity {
  readonly id: string;
  readonly version: number;
}

/** Barvy obrázku po pixelech (index palety, `null` bez barvy a na obrysu). */
export interface PictureColors {
  colorAt(x: number, y: number): number | null;
}

/** Obrázek přečtený ze záznamu. */
export interface DecodedPicture {
  readonly selectedColor: number;
  readonly colors: PictureColors;
}

/** Krátký tón po vrácení tahu (#89 AC1): dva klesající tóny, dozní za 0,2 s. */
export const UNDO_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.14 },
  { frequencyHz: 523.25, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.14 },
];

/** Tichý tón, když se Zpět jen zhoupne (#89 AC3), stejný jako u domečku. */
export const UNDO_WOBBLE_TONES: readonly Tone[] = HOME_WOBBLE_TONES;

/** Co udělalo ťuknutí na Zpět (#89). */
export type UndoResult =
  /** Obrázek se vrátil o tah: scéna překreslí `changed` a zahraje tón. */
  | { readonly kind: 'undone'; readonly changed: ChangedArea; readonly tones: readonly Tone[] }
  /** Není co vracet: tlačítko se jen zhoupne s tichým tónem. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Ťuknutí uprostřed tahu: nic se nestane, tah pokračuje. */
  | { readonly kind: 'ignored' };

export interface SavedColoring {
  /**
   * Prst se dotkl obrázku; štětec maluje barvou vybranou v paletě, guma
   * gumuje (#90). Otevřený panel nástrojů zavře (#96 AC4). Vrátí, co se změnilo.
   */
  pointerDown(pointer: PointerSample): ChangedArea | null;
  /** Prst se posunul. Vrátí, co se zabarvilo. */
  pointerMove(pointer: PointerSample): ChangedArea | null;
  /** Prst se zvedl; dokončený tah se uloží. */
  pointerUp(pointerId: number): void;
  /** Systém tah přerušil: tah skončí tam, kam došel, a uloží se. */
  interrupt(): void;
  /** Odchod domečkem, schování nebo zavření stránky: ukončí tah a uloží obrázek. */
  suspend(): void;
  /**
   * Ťuknutí na barvu: vybere ji i štětec (#90 AC4), hned uloží a vrátí tón
   * k zahrání. Během tahu se nepočítá (druhý prst) a vrátí `[]`.
   */
  tapColor(index: number): readonly Tone[];
  /**
   * Ťuknutí na Zpět (#89): vrátí poslední tah (nejvýš 20 zpět) a hned
   * uloží. Historie je jen v paměti do odchodu z hry; `suspend` ji nemaže.
   */
  tapUndo(): UndoResult;
  /** Stav palety (vybraná barva). */
  palette(): PaletteState;
  /** Je panel nástrojů otevřený (#96)? */
  panelOpen(): boolean;
  /**
   * Ťuknutí na úchyt (#96 AC2): panel otevře, nebo zavře a vrátí tón.
   * Během tahu se nepočítá (druhý prst) a vrátí `[]`.
   */
  tapHandle(): readonly Tone[];
  /** Co ukazuje úchyt: vybraný nástroj ve vybrané barvě, guma bez barvy (#96 AC5, #90). */
  handleView(): HandleView;
  /** Vybraný nástroj (#90). */
  selectedTool(): ToolId;
  /**
   * Ťuknutí na místo `index` nástrojů v panelu (#90 AC1): vybere nástroj
   * a vrátí tón, i když už vybraný byl. Prázdné místo a ťuknutí během tahu
   * nic nezmění a vrátí `[]`.
   */
  tapTool(index: number): readonly Tone[];
  /** Index barvy v pixelu; `null` bez barvy, na obrysu a mimo plochu. */
  colorAt(x: number, y: number): number | null;
}

/** Klíč záznamu v úložišti hry; profil a hru doplní úložiště profilu. */
function recordKey(picture: PictureIdentity): string {
  return `picture.${picture.id}`;
}

/** Kontrolní součet FNV-1a (32 bitů) jako 8 šestnáctkových číslic. */
function checksumOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isPaletteIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < PALETTE.length;
}

/** Záznam z vrstvy barev a vybrané barvy. */
function recordOf(
  picture: PictureIdentity,
  regions: RegionMap,
  layer: Uint8Array,
  selectedColor: number,
): string {
  const body = [
    RECORD_FORMAT,
    picture.id,
    String(picture.version),
    String(regions.width),
    String(regions.height),
    String(selectedColor),
    encodeColorLayer(regions, layer),
  ].join(FIELD_SEPARATOR);
  return `${body}${FIELD_SEPARATOR}${checksumOf(body)}`;
}

/** Zakóduje obrázek do záznamu (s kontrolním součtem, verzí a rozměrem). */
export function encodePicture(options: {
  readonly picture: PictureIdentity;
  readonly regions: RegionMap;
  readonly colors: PictureColors;
  readonly selectedColor: number;
}): string {
  const { picture, regions, colors, selectedColor } = options;
  const layer = emptyColorLayer(regions);
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const color = colors.colorAt(x, y);
      if (color !== null && isPaletteIndex(color)) {
        layer[y * regions.width + x] = color;
      }
    }
  }
  return recordOf(picture, regions, layer, selectedColor);
}

/** Vrstva a vybraná barva ze záznamu; `null` u neplatného nebo cizího záznamu. */
function readRecord(
  record: string,
  picture: PictureIdentity,
  regions: RegionMap,
): { layer: Uint8Array; selectedColor: number } | null {
  if (record.length > PICTURE_RECORD_LIMIT) {
    return null;
  }
  const fields = record.split(FIELD_SEPARATOR);
  if (fields.length !== RECORD_FIELD_COUNT) {
    return null;
  }
  const [format, id, version, width, height, selected, data, checksum] = fields;
  const body = fields.slice(0, -1).join(FIELD_SEPARATOR);
  const matches =
    checksum === checksumOf(body) &&
    format === RECORD_FORMAT &&
    id === picture.id &&
    version === String(picture.version) &&
    width === String(regions.width) &&
    height === String(regions.height);
  const selectedColor = Number(selected);
  if (!matches || !isPaletteIndex(selectedColor) || selected !== String(selectedColor)) {
    return null;
  }
  const layer = decodeColorLayer(regions, data ?? '');
  return layer === null ? null : { layer, selectedColor };
}

/** Přečte záznam; `null`, když je poškozený, nečitelný nebo jiné omalovánky. */
export function decodePicture(
  record: string,
  picture: PictureIdentity,
  regions: RegionMap,
): DecodedPicture | null {
  const read = readRecord(record, picture, regions);
  if (read === null) {
    return null;
  }
  const { layer, selectedColor } = read;
  return {
    selectedColor,
    colors: {
      colorAt(x, y) {
        const column = Math.floor(x);
        const row = Math.floor(y);
        if (column < 0 || row < 0 || column >= regions.width || row >= regions.height) {
          return null;
        }
        const value = layer[row * regions.width + column] ?? NO_COLOR;
        return value === NO_COLOR ? null : value;
      },
    },
  };
}

/** Uložený záznam z úložiště; selhání čtení je jako chybějící záznam. */
function loadRecord(storage: KeyValueStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch (error) {
    // Zakázané úložiště: hra začne s prázdnou omalovánkou (AC4).
    console.warn('Omalovánky: uložený obrázek nejde přečíst', error);
    return null;
  }
}

/** Uloží záznam; vrátí, jestli se to povedlo. Chyba úložiště hru nezastaví (AC5). */
function storeRecord(storage: KeyValueStorage, key: string, record: string): boolean {
  if (record.length > PICTURE_RECORD_LIMIT) {
    console.warn('Omalovánky: obrázek je na uložení moc velký');
    return false;
  }
  try {
    storage.setItem(key, record);
    return true;
  } catch (error) {
    console.warn('Omalovánky: obrázek nejde uložit', error);
    return false;
  }
}

/** Úložiště jen v paměti, když hra žádné nedostala. */
function memoryStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };
}

/**
 * Otevře omalovánku `picture` nad úložištěm hry aktivního profilu.
 * Pokračuje v uloženém obrázku, nebo začne prázdný s první barvou.
 */
export function openColoring(options: {
  readonly regions: RegionMap;
  readonly picture: PictureIdentity;
  readonly storage: KeyValueStorage | undefined;
}): SavedColoring {
  const { regions, picture } = options;
  const storage = options.storage ?? memoryStorage();
  const key = recordKey(picture);
  const stored = loadRecord(storage, key);
  const restored = stored === null ? null : readRecord(stored, picture, regions);

  const coloring = createColoring(regions, restored === null ? {} : { colors: restored.layer });
  let palette: PaletteState =
    restored === null ? initialPalette() : { selected: restored.selectedColor };
  /** Prst, který právě maluje (tah ještě neskončil). */
  let strokePointer: number | null = null;
  /** Je od posledního úspěšného uložení něco nového? */
  let unsaved = false;
  /** Vratné tahy od otevření omalovánky (#89); nové otevření začne bez historie. */
  const history = createUndoHistory();
  /** Panel nástrojů: otevřený jen při úplně prvním otevření hry v profilu (#96 AC2). */
  let panelOpen = !wasOpenedBefore(storage);
  /** Je v úložišti záznam, že profil hru už otevřel? */
  let openingRemembered = !panelOpen;
  /** Vybraný nástroj; nepamatuje se, po otevření je vždy štětec (#90 AC1). */
  let tool: ToolId = INITIAL_TOOL;

  /** Zapíše první otevření spolu s prvním ukládáním (#92 AC1: samotné otevření nic nezapíše). */
  const rememberOpening = (): void => {
    if (!openingRemembered) {
      rememberOpened(storage);
      openingRemembered = true;
    }
  };

  const save = (): void => {
    rememberOpening();
    if (!unsaved) {
      return;
    }
    const record = recordOf(picture, regions, coloring.colorLayer(), palette.selected);
    if (storeRecord(storage, key, record)) {
      unsaved = false;
    }
  };

  const noteChange = (area: ChangedArea | null): ChangedArea | null => {
    if (area !== null) {
      unsaved = true;
    }
    return area;
  };

  /** Tah skončil: co opravdu změnil, jde vrátit (#89 AC4), a obrázek se uloží. */
  const finishStroke = (): void => {
    strokePointer = null;
    const change = coloring.takeStrokeChange();
    if (change !== null) {
      history.push(change);
    }
    save();
  };

  const endStroke = (): void => {
    coloring.interrupt();
    finishStroke();
  };

  return {
    pointerDown(pointer) {
      panelOpen = false;
      if (strokePointer === null) {
        strokePointer = pointer.id;
      }
      return noteChange(coloring.pointerDown(pointer, palette.selected, tool));
    },

    pointerMove(pointer) {
      return noteChange(coloring.pointerMove(pointer));
    },

    pointerUp(pointerId) {
      coloring.pointerUp(pointerId);
      if (strokePointer === pointerId) {
        finishStroke();
      }
    },

    interrupt: endStroke,

    suspend: endStroke,

    tapColor(index) {
      if (strokePointer !== null) {
        return [];
      }
      if (isPaletteIndex(index)) {
        // Barva patří štětci: po gumě se maluje hned vybranou barvou (#90 AC4).
        tool = 'brush';
      }
      const { state, tones } = tapColor(palette, index);
      if (state.selected !== palette.selected) {
        unsaved = true;
      }
      palette = state;
      save();
      return tones;
    },

    tapUndo() {
      if (strokePointer !== null) {
        return { kind: 'ignored' };
      }
      const change = history.pop();
      if (change === null) {
        return { kind: 'wobble', tones: UNDO_WOBBLE_TONES };
      }
      coloring.restore(change);
      unsaved = true;
      save();
      return { kind: 'undone', changed: change.area, tones: UNDO_TONES };
    },

    palette: () => palette,

    panelOpen: () => panelOpen,

    tapHandle() {
      if (strokePointer !== null) {
        return [];
      }
      panelOpen = !panelOpen;
      return panelOpen ? PANEL_OPEN_TONES : PANEL_CLOSE_TONES;
    },

    handleView: () => ({ tool, color: tool === 'eraser' ? null : palette.selected }),

    selectedTool: () => tool,

    tapTool(index) {
      const tapped = toolAtSlot(index);
      if (strokePointer !== null || tapped === null) {
        return [];
      }
      tool = tapped;
      return TOOL_PICK_TONES;
    },

    colorAt: (x, y) => coloring.colorAt(x, y),
  };
}
