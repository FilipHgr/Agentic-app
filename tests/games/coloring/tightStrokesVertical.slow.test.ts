import { describe, it } from 'vitest';

import { ALL_SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';
import { expectTightStrokesFit } from './tightStrokesChecks';
import { PAINTING_TOOLS } from './tightStrokesHelpers';

/**
 * Testy k #119 AC2 první část: totéž jako AC1 pro těsné svislé tahy přes
 * celou výšku se stejným rozestupem (po sloupcích zleva, ve sloupci
 * shora). Matice, kontroly a vzor jsou stejné jako u vodorovných tahů
 * (`tightStrokesHorizontal.slow.test.ts`, `tightStrokesHelpers.ts`).
 *
 * Dnešní svislé tahy po W střední z #116 AC6 (duha a razítkový fix)
 * a ostatní dnešní vzory limitu hlídají dál jejich vlastní testy;
 * #116 AC6 je podle AC2 zpřísněný na 45 000 znaků
 * (`toolColorSetsLimit.test.ts`).
 *
 * Pomalá skupina (otázka 3): jeden test na nástroj a tloušťku, každý
 * pod 20 s.
 *
 * Naměřeno před #119 s formátem p4 (nejdelší záznam ze tří obrysů a čtyř
 * pořadí): proužkový fix nejtenčí a malý 44 586, razítkový fix nejtenčí
 * 43 704, sprej 2 W nejtenčí 36 856 znaků, ostatní pod 39 000. Svislé
 * tahy se tedy do 45 000 vejdou už dnes, testy hlídají, aby to nové
 * ukládání nezhoršilo.
 */

describe('#119 AC2: těsné svislé tahy se vejdou do 45 000 znaků', () => {
  for (const tool of PAINTING_TOOLS) {
    for (const size of ALL_SIZES) {
      it(`${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}: obrázek z těsných svislých tahů v různých barvách se uloží celý a po návratu je stejný`, () => {
        expectTightStrokesFit(tool, size, 'vertical');
      });
    }
  }
});
