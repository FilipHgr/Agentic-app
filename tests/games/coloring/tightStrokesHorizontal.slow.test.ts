import { describe, it } from 'vitest';

import { ALL_SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';
import { expectTightStrokesFit } from './tightStrokesChecks';
import { PAINTING_TOOLS } from './tightStrokesHelpers';

/**
 * Testy k #119 AC1: obrázek z těsných vodorovných tahů se vejde do 45 000
 * znaků (rezerva 10 % pod limitem 50 000) a přečte se pixel po pixelu.
 *
 * Matice: všech 9 malovacích nástrojů bez gumy, každý ve všech čtyřech
 * tloušťkách včetně nejtenčí z #118, tři nejhorší obrysy (prázdný,
 * mřížka, domeček) a čtyři pořadí barev (46 barev sad po sloupcích tabulky
 * a střídáním vzdálených barev, zkušební paleta 64 barev 0, 1, 2, …
 * a 0, 63, 1, 62, …). Vzor tahů popisuje `tightStrokesHelpers.ts`: tahy
 * po řádcích shora a v řádku zleva, barva n-tého tahu je n-tá barva
 * pořadí, duha se jen přemapuje.
 *
 * U nejhoršího obrázku (nejdelší záznam) každého nástroje a tloušťky se
 * navíc ověří, že se ve hře po návratu z menu i po obnovení stránky
 * obnoví pixel po pixelu stejně. Tím je pokrytý i nejhorší obrázek
 * každého nástroje z AC1.
 *
 * Pomalá skupina (otázka 3): jeden test na nástroj a tloušťku, každý
 * pod 20 s. Svislé tahy z AC2 jsou v `tightStrokesVertical.slow.test.ts`.
 *
 * Naměřeno před #119 s formátem p4 (nejdelší záznam ze tří obrysů a čtyř
 * pořadí): pastelka nejtenčí 97 908, malá 87 752, střední 81 486 znaků
 * (selžou), pastelka velká 42 499, fix nejtenčí 43 054, sprej 2 W
 * nejtenčí 32 705, ostatní pod 34 000.
 */

describe('#119 AC1: těsné vodorovné tahy se vejdou do 45 000 znaků', () => {
  for (const tool of PAINTING_TOOLS) {
    for (const size of ALL_SIZES) {
      it(`${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}: obrázek z těsných vodorovných tahů v různých barvách se uloží celý a po návratu je stejný`, () => {
        expectTightStrokesFit(tool, size, 'horizontal');
      });
    }
  }
});
