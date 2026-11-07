import { describe, expect, it } from 'vitest';

import {
  LAYOUT_RULES,
  edgeViolations,
  fitViolations,
  overlapViolations,
  tapGapViolations,
  tapSizeViolations,
  textFitViolations,
} from './layoutRules';
import type { LayoutItem, LayoutScene } from './layoutRules';
import type { Box } from './viewportFixtures';

/**
 * Testy k #81: společná pravidla rozložení fungují pro jakoukoli obrazovku
 * (dnes Počítání, později i menu). Obrazovka je vymyšlená: okno 400 × 300
 * a dvě tlačítka 64 × 64 px daleko od sebe i od okraje.
 */

const FREE: Box = { left: 0, right: 400, top: 0, bottom: 300 };

function square(left: number, top: number, side = 64): Box {
  return { left, right: left + side, top, bottom: top + side };
}

function sceneWith(items: LayoutItem[], extra: Partial<LayoutScene> = {}): LayoutScene {
  return { label: '400×300, zkušební obrazovka', free: FREE, items, ...extra };
}

const GOOD_ITEMS: LayoutItem[] = [
  { name: 'tlačítko A', box: square(20, 20), tappable: true },
  { name: 'tlačítko B', box: square(200, 20), tappable: true },
  { name: 'nápis', box: { left: 20, right: 380, top: 200, bottom: 240 } },
];

describe('#81: společná pravidla rozložení', () => {
  it('dobré rozložení projde všemi pravidly', () => {
    for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
      expect(rule(sceneWith(GOOD_ITEMS)), ruleName).toEqual([]);
    }
  });

  it('prvek mimo volnou plochu poruší „vejde se“ a zpráva řekne prvek a stranu', () => {
    const scene = sceneWith([{ name: 'okénko 2', box: { ...square(20, 250), bottom: 314 } }]);

    expect(fitViolations(scene)).toEqual([
      '400×300, zkušební obrazovka: okénko 2 přesahuje spodní okraj o 14 px',
    ]);
  });

  it('překryv poruší „nic se nepřekrývá“, dotyk hranou ani schválený překryv ne', () => {
    const touching = sceneWith([
      { name: 'A', box: square(20, 20) },
      { name: 'B', box: square(84, 20) },
    ]);
    const overlapping = sceneWith([
      { name: 'A', box: square(20, 20) },
      { name: 'B', box: square(80, 20) },
    ]);
    const approved = { ...overlapping, mayOverlap: () => true };

    expect(overlapViolations(touching)).toEqual([]);
    expect(overlapViolations(overlapping)).toEqual([
      '400×300, zkušební obrazovka: A se překrývá s B',
    ]);
    expect(overlapViolations(approved)).toEqual([]);
  });

  it('vyhrazený roh hlídá jen překryv: nic do něj nesmí, sám se do okna vejít nemusí', () => {
    const corner: LayoutItem = {
      name: 'roh kolečka',
      box: { left: 320, right: 420, top: -10, bottom: 80 },
      reserved: true,
    };
    const empty = sceneWith([corner, ...GOOD_ITEMS]);
    const used = sceneWith([corner, { name: 'hvězdička', box: square(330, 10, 24) }]);

    expect(fitViolations(empty)).toEqual([]);
    expect(edgeViolations(empty)).toEqual([]);
    expect(overlapViolations(empty)).toEqual([]);
    expect(overlapViolations(used)).toEqual([
      '400×300, zkušební obrazovka: roh kolečka se překrývá s hvězdička',
    ]);
  });

  it('malá ťukací plocha poruší 64 px, schválená menší plocha a netukací prvek ne', () => {
    const small: LayoutItem = { name: 'tečka 1', box: square(20, 20, 48), tappable: true };

    expect(tapSizeViolations(sceneWith([small]))).toEqual([
      '400×300, zkušební obrazovka: tečka 1 má jen 48 px × 48 px, potřebuje aspoň 64 px',
    ]);
    expect(tapSizeViolations(sceneWith([{ ...small, minSide: 48 }]))).toEqual([]);
    expect(tapSizeViolations(sceneWith([{ ...small, tappable: false }]))).toEqual([]);
  });

  it('ťukací plochy blíž než 8 px poruší mezeru, schválená dvojice ne', () => {
    const items: LayoutItem[] = [
      { name: 'tlačítko 1', box: square(20, 20), tappable: true },
      { name: 'tlačítko 2', box: square(88.5, 20), tappable: true },
    ];

    expect(tapGapViolations(sceneWith(items))).toEqual([
      '400×300, zkušební obrazovka: mezi tlačítko 1 a tlačítko 2 je jen 4,5 px, potřebuje aspoň 8 px',
    ]);
    expect(tapGapViolations(sceneWith(items, { gapExempt: () => true }))).toEqual([]);
  });

  it('prvek blíž než 4 px od okraje poruší odstup, přísnější odstup prvku se hlídá taky', () => {
    const nearEdge: LayoutItem = { name: '✓', box: square(2, 100), tappable: true };
    const strict: LayoutItem = { name: 'volba', box: square(6, 100), minEdge: 8 };

    expect(edgeViolations(sceneWith([nearEdge]))).toEqual([
      '400×300, zkušební obrazovka: ✓ je blíž než 4 px k okraji, levý okraj o 2 px',
    ]);
    expect(edgeViolations(sceneWith([strict]))).toEqual([
      '400×300, zkušební obrazovka: volba je blíž než 8 px k okraji, levý okraj o 2 px',
    ]);
  });

  it('oříznutá dlaždice v posouvané ploše měří 64 px na celé ploše, ne na viditelné části', () => {
    const cut: LayoutItem = {
      name: 'dlaždice 5',
      box: { left: 20, right: 84, top: 20, bottom: 30 },
      whole: square(20, -34),
      tappable: true,
    };

    expect(tapSizeViolations(sceneWith([cut]))).toEqual([]);
    expect(tapSizeViolations(sceneWith([{ ...cut, whole: square(20, -34, 40) }]))).toEqual([
      '400×300, zkušební obrazovka: dlaždice 5 má jen 40 px × 40 px, potřebuje aspoň 64 px',
    ]);
  });

  it('skrytý posouvaný prvek měří jen 64 px a text, schválená menší mezera dvojice se hlídá taky', () => {
    const hidden: LayoutItem = {
      name: 'dlaždice 30',
      box: square(20, 400, 40),
      whole: square(20, 400, 40),
      hidden: true,
      tappable: true,
      texts: [{ text: 'Hra 30 je moc dlouhá', fontSize: 20 }],
    };
    const scene = sceneWith([...GOOD_ITEMS, hidden]);
    const bar: LayoutItem = { name: 'lišta', box: square(20, 20), tappable: true };
    const touching: LayoutItem = { name: 'dlaždice 1', box: square(84, 20), tappable: true };
    const pair = sceneWith([bar, touching], { minGap: () => 0 });

    expect(fitViolations(scene)).toEqual([]);
    expect(overlapViolations(scene)).toEqual([]);
    expect(tapGapViolations(scene)).toEqual([]);
    expect(tapSizeViolations(scene)).toEqual([
      '400×300, zkušební obrazovka: dlaždice 30 má jen 40 px × 40 px, potřebuje aspoň 64 px',
    ]);
    expect(textFitViolations(scene)).toHaveLength(1);
    expect(tapGapViolations(pair)).toEqual([]);
    expect(tapGapViolations({ ...pair, minGap: () => 2 })).toEqual([
      '400×300, zkušební obrazovka: mezi lišta a dlaždice 1 je jen 0 px, potřebuje aspoň 2 px',
    ]);
  });
});

describe('#82: pravidlo „text se vejde do své plochy“', () => {
  const tile: LayoutItem = { name: 'dlaždice 1', box: square(20, 20, 100) };

  it('text, který se vejde i s rezervou 8 px, projde; delší nebo prázdný ne', () => {
    // „Hra 1“ má 5 znaků: 5 × 0,6 × 20 + 2 × 8 = 76 px ≤ 100 px.
    const fits = sceneWith([{ ...tile, texts: [{ text: 'Hra 1', fontSize: 20 }] }]);
    // 8 znaků: 8 × 0,6 × 20 + 16 = 112 px > 100 px.
    const tooWide = sceneWith([{ ...tile, texts: [{ text: 'Hra 1234', fontSize: 20 }] }]);
    const empty = sceneWith([{ ...tile, texts: [{ text: ' ', fontSize: 20 }] }]);

    expect(textFitViolations(fits)).toEqual([]);
    expect(textFitViolations(tooWide)).toEqual([
      '400×300, zkušební obrazovka: text „Hra 1234“ v dlaždice 1 potřebuje šířku 112 px, plocha má 100 px',
    ]);
    expect(textFitViolations(empty)).toEqual([
      '400×300, zkušební obrazovka: v dlaždice 1 chybí text',
    ]);
  });

  it('přezdívka na dva řádky se dělí rovným dílem a hlídá se i výška řádků', () => {
    const nickname = (height: number): LayoutItem => ({
      name: 'přezdívka 1',
      box: { left: 20, right: 116, top: 100, bottom: 100 + height },
      texts: [
        {
          text: 'WWWWWWWWWWWW',
          fontSize: 16,
          charWidth: 1,
          maxLines: 2,
          lineHeight: 20,
          padding: 0,
        },
      ],
    });

    // 6 písmen × 16 px = 96 px na řádek, dva řádky po 20 px = 40 px.
    expect(textFitViolations(sceneWith([nickname(40)]))).toEqual([]);
    expect(textFitViolations(sceneWith([nickname(39)]))).toEqual([
      '400×300, zkušební obrazovka: text „WWWWWWWWWWWW“ v přezdívka 1 potřebuje výšku 40 px, plocha má 39 px',
    ]);
  });
});
