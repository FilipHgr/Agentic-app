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
 * rozměr) dá prázdnou omalovánku (AC4). Stejně tak záznam s barvou, kterou
 * formát zná, ale paleta ne (#100 AC5, #115 AC4).
 *
 * Velikost palety (#115) je volba `paletteSize`, bez ní všech 46 barev
 * ze sad nástrojů (`ALL_COLORS`, #116).
 * Formáty p4 a p5 znají nejvýš 64 barev (`MAX_PALETTE_SIZE`); barvy 0 až
 * `paletteSize − 1` jde vybrat, malovat, uložit a obnovit, včetně barev
 * nástrojů a nedávných barev. Selhání úložiště
 * hra nikdy nevyhodí (AC5); co se nepodaří uložit, drží v paměti úložiště
 * profilu (`gameStorage`) do zavření stránky.
 *
 * Zpět (#89) vrací tahy z historie v paměti (`strokeHistory.ts`), vrácený
 * stav se uloží stejně jako po tahu. Panel nástrojů (#96) se otevírá
 * úchytem a zavře se i tahem po obrázku; při prvním otevření hry v profilu
 * začíná otevřený (`toolPanel.ts`). Od #105 je ve dvou krocích: úchyt ho
 * otevře vždy na nástrojích, nástroj s barvou přepne na krok barev, výběr
 * barvy, guma a duha panel zavřou. Krok se neukládá.
 *
 * Vybraný nástroj (štětec, guma, fix, pastelka, duha, razítkový, puntíkový
 * nebo proužkový fix, třpytky, sprej, #90, #93, #97, #98, #101–#104) je jen v paměti: po otevření hry je vždy štětec, výběr barvy po gumě
 * přepne na naposledy vybraný malovací nástroj. Duha vybranou barvu
 * nepoužívá, výběr barvy u ní (i po gumě) přepne na štětec. Ťuknutí na nástroj, barvu, úchyt,
 * tlačítko tloušťky nebo Zpět druhým prstem během tahu se nepočítá (AC3).
 *
 * Velikost čáry (#91) platí pro všechny nástroje a pamatuje se podle
 * profilu v samostatném záznamu vedle obrázku (`toolPanel.ts`), záznam
 * obrázku zůstává beze změny. Změna velikosti obrázek nemění
 * a do Zpět se nepočítá.
 *
 * Dvě nedávné barvy v pruhu (#99) se mění každým výběrem barvy (v pruhu
 * i v panelu) podle `recentColors.ts`, ukládají se hned po výběru do
 * samostatného záznamu vedle obrázku a Zpět je nemění.
 *
 * Každý malovací nástroj má od #110 svou barvu (`toolColors.ts`). Výběr
 * barvy ji dá jen nástroji, který barvu dostává: vybranému malovacímu
 * nástroji, po gumě naposledy vybranému, po duze štětci. Barvy nástrojů
 * se ukládají hned po výběru barvy a s každým uložením obrázku do
 * samostatného záznamu. Jako vybraná barva se do záznamu obrázku ukládá
 * naposledy vybraná barva: když záznam barev nástrojů chybí nebo je
 * poškozený, dostanou ji všechny nástroje (#110 AC6), bez obrázku platí
 * výchozí barvy.
 *
 * Od #116 má každý malovací nástroj v kroku barev vlastní sadu 12 barev
 * (`toolColorSets.ts`). Krok barev ukazuje sadu nástroje, který by výběr
 * dostal, a označí místo jeho barvy. Barvu mimo sadu (starší záznam,
 * nedávná barva) nástroj má a maluje jí dál, v kroku barev pak není
 * označené nic (#116 AC5).
 *
 * Fotoaparát (#126) uloží hotový obrázek do alba aktivního profilu
 * (`album.ts`). Album dostane malování přečtené při otevření omalovánky,
 * takže po ťuknutí hned ví, jestli se obrázek uloží (AC2 a). Prázdný
 * obrázek, obrázek stejný jako obrázek té omalovánky v albu, plné album,
 * nedostupné nebo ještě nepřečtené album a dočasný profil fotoaparát jen
 * zhoupnou. Jinak hned cvak a ukládání; během ukládání se nemaluje
 * a další ťuknutí fotoaparát jen zhoupne. Teprve po potvrzeném uložení je
 * omalovánka čistá a zapíše se do úložiště; barvy nástrojů, nedávné barvy
 * a tloušťka zůstanou a historie Zpět se vyprázdní. Ukládání doběhne
 * i po odchodu z malování.
 * Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords, RecordData, RecordsAdd } from '../../../shared/storage/profileRecords';
import type { Tone } from '../../../shared/audio/tonePlayer';
import { HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import {
  ALBUM_PICTURE_LIMIT,
  ALBUM_RECORD_LIMIT,
  CAMERA_CLICK_TONES,
  albumEntryOf,
  albumRecordOf,
  sameLayers,
} from './album';
import type { AlbumContents } from './album';
import { NO_COLOR, createColoring, emptyColorLayer, strokeWidthFor } from './coloring';
import type { ChangedArea, PointerSample } from './coloring';
import { isPaletteIndex, tapColor } from './palette';
import type { PaletteState } from './palette';
import {
  CURRENT_LAYER_CODE,
  LAYER_COLOR_COUNT,
  MAX_LAYER_COLOR_COUNT,
  decodeColorLayer,
  encodeColorLayer,
} from './colorLayerCode';
import type { LayerCodeVersion } from './colorLayerCode';
import type { RegionMap } from './regionMap';
import { loadRecentColors, recentAfterPick, storeRecentColors } from './recentColors';
import type { RecentColors } from './recentColors';
import { createUndoHistory } from './strokeHistory';
import { ALL_COLOR_COUNT, TOOL_COLOR_SETS, placeInSet } from './toolColorSets';
import {
  DEFAULT_TOOL_COLORS,
  allToolsIn,
  isColorTool,
  loadToolColors,
  storeToolColors,
  toolReceivingColor,
  withToolColor,
} from './toolColors';
import type { ToolColors } from './toolColors';
import {
  BACK_TO_TOOLS_TONES,
  INITIAL_TOOL,
  PANEL_CLOSE_TONES,
  PANEL_OPEN_TONES,
  LINE_SIZE_TONES,
  TOOL_PICK_TONES,
  loadLineSize,
  paintsWithColor,
  rememberOpened,
  storeLineSize,
  toolAtSlot,
  hasColorStep,
  wasOpenedBefore,
} from './toolPanel';
import type { HandleView, LineSize, PanelView, ToolId } from './toolPanel';

/** Nejdelší záznam jedné omalovánky ve znacích (AC6). */
export const PICTURE_RECORD_LIMIT = 50_000;

/** Nejvíc barev palety, které ukládaný formát zná (#115 AC1). */
export const MAX_PALETTE_SIZE: number = MAX_LAYER_COLOR_COUNT;

/**
 * Označení formátu záznamu je verze kódování vrstvy barev; při změně
 * kódování se zvýší. Ukládá se v nejnovější (p5 s 64 barvami a aritmetickým
 * kódováním, #119), číst jde i starší s 8 barvami (p1 z #92, p2 z #93),
 * s 12 barvami (p3 z #100) a s 64 barvami (p4 z #115).
 */
const READABLE_FORMATS: readonly LayerCodeVersion[] = ['p1', 'p2', 'p3', 'p4', 'p5'];

function isReadableFormat(format: string | undefined): format is LayerCodeVersion {
  return READABLE_FORMATS.some((readable) => readable === format);
}

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

/** Tichý tón, když se prázdné místo nedávné barvy jen zhoupne (#99 AC3), stejný jako u Zpět. */
export const RECENT_COLOR_WOBBLE_TONES: readonly Tone[] = UNDO_WOBBLE_TONES;

/** Co udělalo ťuknutí na místo nedávné barvy v pruhu (#99). */
export type RecentColorTap =
  /** Barva se vybrala: scéna překreslí výběr a zahraje tón. */
  | { readonly kind: 'picked'; readonly tones: readonly Tone[] }
  /** Prázdné místo: jen se zhoupne s tichým tónem a nic nevybere. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Ťuknutí druhým prstem během tahu: nic se nestane, tah pokračuje. */
  | { readonly kind: 'ignored' };

/** Jak skončilo ukládání do alba po cvaku (#126 AC1, AC2 b). */
export type CameraSaveResult =
  /** Uloženo: omalovánka je čistá, scéna překreslí `changed`. */
  | { readonly kind: 'saved'; readonly changed: ChangedArea }
  /** Úložiště vrátilo „plné“ nebo „nedostupné“: obrázek zůstal, fotoaparát se zhoupne. */
  | { readonly kind: 'failed'; readonly tones: readonly Tone[] };

/** Co udělalo ťuknutí na fotoaparát (#126). */
export type CameraTap =
  /** Hned cvak a animace; `done` skončí, až úložiště uložení potvrdí nebo odmítne. */
  | {
      readonly kind: 'saving';
      readonly tones: readonly Tone[];
      readonly done: Promise<CameraSaveResult>;
    }
  /** Obrázek se neuloží (AC2 a, c): fotoaparát se jen zhoupne s tónem domečku. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Ťuknutí, když jiný prst maluje (AC3): nic, ani zhoupnutí. */
  | { readonly kind: 'ignored' };

/** Album aktivního profilu pro malování: záznamy a jejich obsah přečtený při otevření. */
export interface ColoringAlbum {
  readonly records: GameRecords | undefined;
  readonly contents: AlbumContents;
}

/** Tón, když se fotoaparát jen zhoupne (#126 AC2), stejný jako u domečku. */
export const CAMERA_WOBBLE_TONES: readonly Tone[] = HOME_WOBBLE_TONES;

export interface SavedColoring {
  /**
   * Prst se dotkl obrázku; malovací nástroj maluje svou barvou (#110 AC1),
   * guma gumuje (#90). Otevřený panel nástrojů zavře (#96 AC4). Vrátí, co se změnilo.
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
   * Ťuknutí na barvu: dá ji jen nástroji, který barvu dostává (#110 AC1,
   * AC3), a vybere ho: po gumě naposledy vybraný malovací nástroj (#90 AC4,
   * #93 AC5), u duhy štětec (#97 AC4). Hned uloží a vrátí tón k zahrání. Panel zavře (#105 AC3), i když už barva vybraná byla.
   * Během tahu se nepočítá (druhý prst) a vrátí `[]`.
   */
  tapColor(index: number): readonly Tone[];
  /**
   * Dvě místa nedávných barev v pořadí pruhu (#99): index barvy palety,
   * `null` u prázdného místa.
   */
  recentColors(): RecentColors;
  /**
   * Ťuknutí na místo `index` nedávných barev (#99 AC1): vybere barvu
   * stejně jako `tapColor`, prázdné místo se jen zhoupne. Panel zůstane,
   * jak byl.
   */
  tapRecentColor(index: number): RecentColorTap;
  /**
   * Ťuknutí na Zpět (#89): vrátí poslední tah (nejvýš 20 zpět) a hned
   * uloží. Historie je jen v paměti do odchodu z hry; `suspend` ji nemaže.
   */
  tapUndo(): UndoResult;
  /**
   * Stav palety: označená je barva nástroje, který by výběr barvy dostal
   * (#110 AC2), v kroku barev tedy barva nástroje na prvním místě.
   */
  palette(): PaletteState;
  /**
   * Krok barev (#116 AC1): 12 čísel barev v pořadí míst, sada nástroje,
   * který by výběr barvy dostal (vybraný malovací nástroj, po gumě
   * naposledy vybraný, po duze štětec). Scéna ťuknutí na místo k hlásí
   * jako `tapColor(colorStep()[k])`.
   */
  colorStep(): readonly number[];
  /**
   * Označené místo kroku barev (0 až 11): místo barvy nástroje z `colorStep`
   * v jeho sadě; `null`, když barvu sada nemá a nic se neoznačí (#116 AC5).
   */
  markedColorPlace(): number | null;
  /**
   * Barva malovacího nástroje `tool` (číslo barvy `ALL_COLORS`), kterou ukazuje krok
   * nástrojů (#110 AC2); guma a duha barvu nemají (`null`).
   */
  toolColor(tool: ToolId): number | null;
  /** Krok panelu: zavřený, krok nástrojů, nebo krok barev (#105). */
  panelView(): PanelView;
  /** Je panel nástrojů otevřený (#96), v kterémkoli kroku? */
  panelOpen(): boolean;
  /**
   * Ťuknutí na úchyt (#96 AC2): zavřený panel otevře vždy na kroku
   * nástrojů (#105 AC1), otevřený v kterémkoli kroku zavře, a vrátí tón.
   * Během tahu se nepočítá (druhý prst) a vrátí `[]`.
   */
  tapHandle(): readonly Tone[];
  /**
   * Ťuknutí na vybraný nástroj na prvním místě kroku barev (#105 AC4):
   * vrátí panel na krok nástrojů s tónem; nástroj, barva ani velikost se
   * nezmění. Mimo krok barev a během tahu nic nezmění a vrátí `[]`.
   */
  tapBackToTools(): readonly Tone[];
  /**
   * Co ukazuje úchyt: vybraný nástroj v jeho barvě (#110 AC2), guma a duha
   * bez barvy, a vybraná velikost (#96 AC5, #90, #91, #97).
   */
  handleView(): HandleView;
  /** Vybraná velikost čáry (#91). */
  lineSize(): LineSize;
  /**
   * Ťuknutí na tlačítko tloušťky `size` (#112 AC2, AC5): vybere ji, při
   * změně hned uloží a vrátí tón té tloušťky, i když už vybraná byla.
   * Panel, nástroj ani barvy nemění. Během tahu se nepočítá a vrátí `[]`.
   */
  tapLineSize(size: LineSize): readonly Tone[];
  /** Vybraný nástroj (#90). */
  selectedTool(): ToolId;
  /**
   * Ťuknutí na místo `index` nástrojů v panelu (#90 AC1): vybere nástroj
   * a vrátí tón, i když už vybraný byl. Nástroj s barvou přepne panel na
   * krok barev, guma a duha panel zavřou (#105 AC2, AC4). Prázdné místo
   * a ťuknutí během tahu nic nezmění a vrátí `[]`.
   */
  tapTool(index: number): readonly Tone[];
  /**
   * Ťuknutí na fotoaparát (#126): uloží hotový obrázek do alba, nebo se
   * jen zhoupne, když se obrázek neuloží. Během tahu jiného prstu nic.
   */
  tapCamera(): CameraTap;
  /** Ukládá se právě obrázek do alba (od cvaku po potvrzení)? Mezitím se nemaluje. */
  savingToAlbum(): boolean;
  /**
   * Album se dočetlo až po otevření malování: malování se otevře hned
   * a fotoaparát se do přečtení alba jen zhoupne (jako u ťuknutí na knihu
   * před přečtením, rozhodnutí koordinátora 2 k #126).
   */
  albumRead(contents: AlbumContents): void;
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

/**
 * Velikost palety z volby `paletteSize`: bez ní všechny barvy sad (#116), jinak
 * omezená na 1 až `MAX_PALETTE_SIZE`, aby se každá barva dala uložit.
 */
function paletteSizeOf(paletteSize: number | undefined): number {
  if (paletteSize === undefined || !Number.isInteger(paletteSize)) {
    return ALL_COLOR_COUNT;
  }
  return Math.min(Math.max(paletteSize, 1), MAX_PALETTE_SIZE);
}

/** Zná paleta s `paletteSize` barvami všechny barvy vrstvy? */
function layerFitsPalette(layer: Uint8Array, paletteSize: number): boolean {
  for (const value of layer) {
    if (value !== NO_COLOR && value >= paletteSize) {
      return false;
    }
  }
  return true;
}

/** Záznam z vrstvy barev a vybrané barvy. */
function recordOf(
  picture: PictureIdentity,
  regions: RegionMap,
  layer: Uint8Array,
  selectedColor: number,
): string {
  const body = [
    CURRENT_LAYER_CODE,
    picture.id,
    String(picture.version),
    String(regions.width),
    String(regions.height),
    String(selectedColor),
    encodeColorLayer(regions, layer),
  ].join(FIELD_SEPARATOR);
  return `${body}${FIELD_SEPARATOR}${checksumOf(body)}`;
}

/**
 * Zakóduje obrázek do záznamu (s kontrolním součtem, verzí a rozměrem).
 * Barvy mimo paletu s `paletteSize` barvami se neuloží.
 */
export function encodePicture(options: {
  readonly picture: PictureIdentity;
  readonly regions: RegionMap;
  readonly colors: PictureColors;
  readonly selectedColor: number;
  readonly paletteSize?: number;
}): string {
  const { picture, regions, colors, selectedColor } = options;
  const paletteSize = paletteSizeOf(options.paletteSize);
  const layer = emptyColorLayer(regions);
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const color = colors.colorAt(x, y);
      if (color !== null && isPaletteIndex(color, paletteSize)) {
        layer[y * regions.width + x] = color;
      }
    }
  }
  return recordOf(picture, regions, layer, selectedColor);
}

/**
 * Vrstva a vybraná barva ze záznamu; `null` u neplatného nebo cizího
 * záznamu a u záznamu s barvou mimo paletu s `paletteSize` barvami.
 */
function readRecord(
  record: string,
  picture: PictureIdentity,
  regions: RegionMap,
  paletteSize: number,
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
  if (!isReadableFormat(format)) {
    return null;
  }
  const matches =
    checksum === checksumOf(body) &&
    id === picture.id &&
    version === String(picture.version) &&
    width === String(regions.width) &&
    height === String(regions.height);
  const selectedColor = Number(selected);
  // Vybraná barva musí být barva, kterou zná verze záznamu (p1 a p2 jen 8
  // barev) i paleta (#100 AC5, #115 AC4).
  const knownColor =
    isPaletteIndex(selectedColor, paletteSize) && selectedColor < LAYER_COLOR_COUNT[format];
  if (!matches || !knownColor || selected !== String(selectedColor)) {
    return null;
  }
  const layer = decodeColorLayer(regions, data ?? '', format);
  if (layer === null || !layerFitsPalette(layer, paletteSize)) {
    return null;
  }
  return { layer, selectedColor };
}

/**
 * Přečte záznam; `null`, když je poškozený, nečitelný, jiné omalovánky,
 * nebo má barvu mimo paletu s `paletteSize` barvami (bez ní všechny barvy sad, #116).
 */
export function decodePicture(
  record: string,
  picture: PictureIdentity,
  regions: RegionMap,
  paletteSize?: number,
): DecodedPicture | null {
  const read = readRecord(record, picture, regions, paletteSizeOf(paletteSize));
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

/**
 * Zapíše záznam alba. Záznamy hry podle #125 nikdy neskončí zamítnutým
 * slibem; kdyby přece, je to jako „nedostupné“ a hra se nezasekne v ukládání.
 */
async function addRecord(records: GameRecords, data: RecordData): Promise<RecordsAdd> {
  try {
    return await records.add(data);
  } catch (error) {
    console.warn('Omalovánky: obrázek nejde uložit do alba', error);
    return { status: 'unavailable' };
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
 * Barvy nástrojů po otevření omalovánky (#110 AC5, AC6): platný záznam
 * barev nástrojů, jinak všechny nástroje v barvě uloženého obrázku, bez
 * obrázku výchozí barvy.
 */
function openingToolColors(
  stored: ToolColors | null,
  restored: { readonly selectedColor: number } | null,
): ToolColors {
  if (stored !== null) {
    return stored;
  }
  return restored === null ? DEFAULT_TOOL_COLORS : allToolsIn(restored.selectedColor);
}

/**
 * Otevře omalovánku `picture` nad úložištěm hry aktivního profilu.
 * Pokračuje v uloženém obrázku, nebo začne prázdný s výchozími barvami.
 * `paletteSize` je počet barev palety (#115), bez něj všechny barvy sad (#116).
 */
export function openColoring(options: {
  readonly regions: RegionMap;
  readonly picture: PictureIdentity;
  readonly storage: KeyValueStorage | undefined;
  readonly paletteSize?: number;
  /** Album aktivního profilu (#126); bez něj fotoaparát nic neuloží. */
  readonly album?: ColoringAlbum;
}): SavedColoring {
  const { regions, picture } = options;
  const paletteSize = paletteSizeOf(options.paletteSize);
  const storage = options.storage ?? memoryStorage();
  const key = recordKey(picture);
  const stored = loadRecord(storage, key);
  const restored = stored === null ? null : readRecord(stored, picture, regions, paletteSize);

  let coloring = createColoring(regions, restored === null ? {} : { colors: restored.layer });
  /** Album přečtené při otevření; po každém uložení se doplní nový obrázek. */
  let album: AlbumContents = options.album?.contents ?? { status: 'unavailable' };
  const albumRecords = options.album?.records;
  /** Ukládá se do alba (od cvaku po potvrzení)? */
  let savingToAlbum = false;
  /** Barva každého malovacího nástroje, pamatuje se podle profilu (#110 AC5). */
  let toolColors: ToolColors = openingToolColors(
    loadToolColors(storage, picture.id, paletteSize),
    restored,
  );
  /** Naposledy vybraná barva; ukládá se jako vybraná barva do záznamu obrázku. */
  let lastPickedColor: number = restored === null ? toolColors.brush : restored.selectedColor;
  /** Prst, který právě maluje (tah ještě neskončil). */
  let strokePointer: number | null = null;
  /** Je od posledního úspěšného uložení něco nového? */
  let unsaved = false;
  /** Vratné tahy od otevření omalovánky (#89); nové otevření začne bez historie. */
  let history = createUndoHistory();
  /** Je v úložišti záznam, že profil hru už otevřel? */
  let openingRemembered = wasOpenedBefore(storage);
  /**
   * Krok panelu: otevřený na nástrojích jen při úplně prvním otevření hry
   * v profilu (#96 AC2, #105 AC1), jinak zavřený.
   */
  let panelView: PanelView = openingRemembered ? 'closed' : 'tools';
  /** Vybraný nástroj; nepamatuje se, po otevření je vždy štětec (#90 AC1). */
  let tool: ToolId = INITIAL_TOOL;
  /** Naposledy vybraný malovací nástroj, na který přepne barva po gumě (#93 AC5). */
  let paintingTool: ToolId = INITIAL_TOOL;
  /** Velikost čáry pro všechny nástroje, pamatuje se podle profilu (#91 AC5). */
  let lineSize: LineSize = loadLineSize(storage);
  /** Dvě nedávné barvy v pruhu, pamatují se podle profilu (#99 AC5). */
  let recentColors: RecentColors = loadRecentColors(storage, picture.id, paletteSize);

  /** Barva, kterou maluje vybraný nástroj; guma a duha ji nepoužijí. */
  const paintColor = (): number => toolColors[toolReceivingColor(tool)];

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
    storeToolColors(storage, picture.id, toolColors);
    const record = recordOf(picture, regions, coloring.colorLayer(), lastPickedColor);
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

  /**
   * Dá barvu `index` (z panelu i z pruhu) nástroji, který barvu dostává,
   * a vybere ho: po gumě se maluje hned touto barvou (#90 AC4), u duhy
   * štětcem (#97 AC4). Posune nedávné barvy a hned uloží. Neplatný index
   * nic nezmění.
   */
  const pickColor = (index: number): readonly Tone[] => {
    if (!isPaletteIndex(index, paletteSize)) {
      return [];
    }
    const receiving = toolReceivingColor(paintingTool);
    tool = receiving;
    paintingTool = receiving;
    const previous = toolColors[receiving];
    const { state, tones } = tapColor({ selected: previous }, index, paletteSize);
    if (state.selected !== previous) {
      unsaved = true;
      toolColors = withToolColor(toolColors, receiving, state.selected);
      lastPickedColor = state.selected;
      storeToolColors(storage, picture.id, toolColors);
      recentColors = recentAfterPick(recentColors, previous, state.selected, paletteSize);
      storeRecentColors(storage, picture.id, recentColors);
    }
    save();
    return tones;
  };

  /**
   * Uloží se vrstva `layer` do alba (#126 AC2 a)? Ne u prázdného obrázku,
   * u obrázku stejného jako obrázek té omalovánky v albu, u plného alba
   * a u alba, které nejde přečíst (rozhodnutí koordinátora 1 a 2 k #126).
   */
  const albumAccepts = (layer: Uint8Array): boolean => {
    if (album.status !== 'read' || albumRecords === undefined) {
      return false;
    }
    if (album.entries.length >= ALBUM_PICTURE_LIMIT || album.recordCount >= ALBUM_RECORD_LIMIT) {
      return false;
    }
    if (layer.every((value) => value === NO_COLOR)) {
      return false;
    }
    return !album.entries.some(
      (entry) =>
        entry.picture.id === picture.id &&
        entry.picture.version === picture.version &&
        sameLayers(regions, entry.layer, layer),
    );
  };

  /** Po potvrzeném uložení: obrázek je v albu a omalovánka čistá jako nová stránka. */
  const afterAlbumSaved = (recordId: string, layer: Uint8Array): CameraSaveResult => {
    if (album.status === 'read') {
      const entry = albumEntryOf(recordId, { identity: picture, regions }, layer);
      album = {
        status: 'read',
        entries: [entry, ...album.entries],
        recordCount: album.recordCount + 1,
      };
    }
    coloring = createColoring(regions, {});
    history = createUndoHistory();
    unsaved = true;
    save();
    return {
      kind: 'saved',
      changed: { left: 0, top: 0, right: regions.width, bottom: regions.height },
    };
  };

  /** Zapíše záznam do alba; obrázek se vyčistí až po potvrzení (AC1). */
  const saveToAlbum = async (
    records: GameRecords,
    data: RecordData,
    layer: Uint8Array,
  ): Promise<CameraSaveResult> => {
    const result = await addRecord(records, data);
    savingToAlbum = false;
    if (result.status !== 'saved') {
      return { kind: 'failed', tones: CAMERA_WOBBLE_TONES };
    }
    return afterAlbumSaved(result.id, layer);
  };

  return {
    pointerDown(pointer) {
      if (savingToAlbum) {
        // Během ukládání do alba se nemaluje (rozhodnutí koordinátora 3 k #126):
        // tah by se po uložení ztratil spolu se stránkou.
        return null;
      }
      panelView = 'closed';
      if (strokePointer === null) {
        strokePointer = pointer.id;
      }
      const width = strokeWidthFor(tool, regions.width, lineSize);
      return noteChange(coloring.pointerDown(pointer, paintColor(), tool, width));
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
      panelView = 'closed';
      return pickColor(index);
    },

    recentColors: () => recentColors,

    tapRecentColor(index) {
      if (strokePointer !== null) {
        return { kind: 'ignored' };
      }
      const color = Number.isInteger(index) ? (recentColors[index] ?? null) : null;
      if (color === null) {
        return { kind: 'wobble', tones: RECENT_COLOR_WOBBLE_TONES };
      }
      return { kind: 'picked', tones: pickColor(color) };
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

    palette: () => ({ selected: toolColors[toolReceivingColor(paintingTool)] }),

    colorStep: () => TOOL_COLOR_SETS[toolReceivingColor(paintingTool)],

    markedColorPlace() {
      const receiving = toolReceivingColor(paintingTool);
      return placeInSet(receiving, toolColors[receiving]);
    },

    toolColor: (colorTool) => (isColorTool(colorTool) ? toolColors[colorTool] : null),

    panelView: () => panelView,

    panelOpen: () => panelView !== 'closed',

    tapHandle() {
      if (strokePointer !== null) {
        return [];
      }
      if (panelView === 'closed') {
        panelView = 'tools';
        return PANEL_OPEN_TONES;
      }
      panelView = 'closed';
      return PANEL_CLOSE_TONES;
    },

    tapBackToTools() {
      if (strokePointer !== null || panelView !== 'colors') {
        return [];
      }
      panelView = 'tools';
      return BACK_TO_TOOLS_TONES;
    },

    handleView: () => ({
      tool,
      color: isColorTool(tool) ? toolColors[tool] : null,
      size: lineSize,
    }),

    lineSize: () => lineSize,

    tapLineSize(size) {
      if (strokePointer !== null) {
        return [];
      }
      if (size !== lineSize) {
        lineSize = size;
        rememberOpening();
        storeLineSize(storage, lineSize);
      }
      return LINE_SIZE_TONES[size];
    },

    selectedTool: () => tool,

    tapTool(index) {
      const tapped = toolAtSlot(index);
      if (strokePointer !== null || tapped === null) {
        return [];
      }
      tool = tapped;
      if (paintsWithColor(tapped)) {
        paintingTool = tapped;
      }
      panelView = hasColorStep(tapped) ? 'colors' : 'closed';
      return TOOL_PICK_TONES;
    },

    tapCamera() {
      if (strokePointer !== null) {
        return { kind: 'ignored' };
      }
      const layer = coloring.colorLayer().slice();
      const data =
        savingToAlbum || !albumAccepts(layer) ? null : albumRecordOf(picture, regions, layer);
      if (data === null || albumRecords === undefined) {
        return { kind: 'wobble', tones: CAMERA_WOBBLE_TONES };
      }
      savingToAlbum = true;
      return {
        kind: 'saving',
        tones: CAMERA_CLICK_TONES,
        done: saveToAlbum(albumRecords, data, layer),
      };
    },

    savingToAlbum: () => savingToAlbum,

    albumRead(contents) {
      if (!savingToAlbum) {
        album = contents;
      }
    },

    colorAt: (x, y) => coloring.colorAt(x, y),
  };
}
