/** Typy k `pngReader.mjs` (pomůcka testů #128). */

export const REPO_ROOT: string;
export const OUTLINE_TOOL: string;

export interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  /** Počet barev palety (0 bez palety). */
  readonly paletteSize: number;
  /** Typy bloků souboru v pořadí. */
  readonly chunkTypes: readonly string[];
  /** Pixely RGBA po řádcích (tvar `ImageData`). */
  readonly data: Uint8ClampedArray;
}

export interface OutlineToolRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Bajty vytvořeného souboru, `null`, když ho nástroj nevytvořil. */
  readonly output: Uint8Array | null;
}

export function pngChunks(bytes: Uint8Array): PngChunk[];
export function decodePng(bytes: Uint8Array): DecodedPng;
export function readRepoFile(path: string): Uint8Array;
export function runOutlineTool(sourcePath: string): OutlineToolRun;
