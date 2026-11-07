/**
 * Zrno pastelky v Omalovánkách (#93): opakovaná dlaždice 16 × 16 pixelů
 * pevně umístěná vůči obrázku. Pastelka barví jen pixely, kde dlaždice
 * nemá mezeru, v mezerách zůstane, co tam bylo předtím. Díky pevné
 * dlaždici dá stejný tah vždy stejné pixely a opakovaný tah mezery
 * nezaplní (AC4).
 *
 * Dlaždice se skládá z čtverečků 2 × 2 pixely, aby mezery byly vidět
 * i na displeji s jemnými pixely. Ze 64 čtverečků je 20 mezer (31 %),
 * v každé řadě i v každém sloupci čtverečků 2 nebo 3, takže je stopa
 * stejně zrnitá v každém směru tahu i u obrysu.
 *
 * Výška dlaždice je i krok předpovědi v kódování vrstvy barev
 * (`colorLayerCode.ts`): pixel o dlaždici výš má stejné zrno.
 * Čistý TypeScript bez Phaseru.
 */

/** Strana čtverečku zrna v pixelech. */
const GRAIN_CELL = 2;

/** Mezery zrna po řadách čtverečků: „x“ je mezera, „.“ barva. */
const GRAIN_CELLS: readonly string[] = [
  '.x...x..',
  '...x...x',
  'x...x.x.',
  '..x..x..',
  '.x.x...x',
  'x.....x.',
  '..x.x..x',
  'x..x.x..',
];

/** Strana dlaždice zrna v pixelech (16). */
export const GRAIN_TILE_SIZE = GRAIN_CELLS.length * GRAIN_CELL;

/** Dlaždice po řádcích pixelů: `true` = mezera. */
const GRAIN_GAPS: readonly boolean[] = buildGaps();

function buildGaps(): boolean[] {
  const gaps: boolean[] = [];
  for (let y = 0; y < GRAIN_TILE_SIZE; y += 1) {
    const row = GRAIN_CELLS[Math.floor(y / GRAIN_CELL)] ?? '';
    for (let x = 0; x < GRAIN_TILE_SIZE; x += 1) {
      gaps.push(row[Math.floor(x / GRAIN_CELL)] === 'x');
    }
  }
  return gaps;
}

/** Je v pixelu (x, y) vrstvy barev mezera zrna pastelky? */
export function isGrainGap(x: number, y: number): boolean {
  const tileX = x % GRAIN_TILE_SIZE;
  const tileY = y % GRAIN_TILE_SIZE;
  return GRAIN_GAPS[tileY * GRAIN_TILE_SIZE + tileX] === true;
}
