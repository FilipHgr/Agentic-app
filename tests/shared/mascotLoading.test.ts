import { describe, expect, it } from 'vitest';

import { MASCOT_MOVES, MAX_DECODED_MOVES, createMascotModel } from '../../src/shared/logic/mascot';
import type { MascotCommand, MascotModel, MascotMove } from '../../src/shared/logic/mascot';

/**
 * Testy k #166 AC3 a AC4: pravidla načítání a paměti pandy jako čistá
 * rozhodovací logika. Panda vrací příkazy pro pohled (stáhnout, uvolnit),
 * pohled jí hlásí dočtení a chybu stažení.
 *
 * AC3: dokud není načtený klid, panda není vidět. Nenačtený pohyb nechá
 * pandu v klidu a po dočtení se dodatečně nepřehraje. Po chybě stažení hra
 * jde dál a příště se stažení zkusí znovu. Stahuje se až při použití pandy.
 * AC4: najednou jsou dekódované nejvýš 3 pohyby kromě klidu, pozdrav se po
 * přehrání uvolní.
 */

function downloads(commands: readonly MascotCommand[]): MascotMove[] {
  return commands.filter((command) => command.type === 'download').map((command) => command.move);
}

function releases(commands: readonly MascotCommand[]): MascotMove[] {
  return commands.filter((command) => command.type === 'release').map((command) => command.move);
}

/** Panda s načteným klidem. */
function shownPanda(): MascotModel {
  const panda = createMascotModel();
  panda.use();
  panda.loaded('idle');
  return panda;
}

/** Pohled pandy, který stažení vyřídí hned: drží, které pohyby jsou v paměti. */
function pandaWithMemory(): {
  panda: MascotModel;
  decoded: Set<MascotMove>;
  run: (c: readonly MascotCommand[]) => void;
} {
  const panda = createMascotModel();
  const decoded = new Set<MascotMove>();
  const run = (commands: readonly MascotCommand[]): void => {
    for (const command of commands) {
      if (command.type === 'download') {
        decoded.add(command.move);
        run(panda.loaded(command.move));
      } else {
        decoded.delete(command.move);
      }
    }
  };
  run(panda.use());
  return { panda, decoded, run };
}

function decodedWithoutIdle(decoded: ReadonlySet<MascotMove>): MascotMove[] {
  return [...decoded].filter((move) => move !== 'idle');
}

describe('#166 AC3: načítání pandy', () => {
  it('panda nic nestahuje, dokud ji hra nepoužije', () => {
    const panda = createMascotModel();
    expect(panda.frame(0)).toBeNull();
    expect(downloads(panda.use())).toEqual(['idle']);
  });

  it('dokud není načtený klid, panda není vidět', () => {
    const panda = createMascotModel();
    panda.use();
    panda.prepare('joy');
    panda.loaded('joy');
    panda.play('joy', 0);
    expect(panda.frame(100)).toBeNull();
    panda.loaded('idle');
    expect(panda.frame(100)).not.toBeNull();
  });

  it('klid se stahuje jen jednou, i když hra pandu použije víckrát', () => {
    const panda = createMascotModel();
    expect(downloads(panda.use())).toEqual(['idle']);
    expect(downloads(panda.use())).toEqual([]);
    panda.loaded('idle');
    expect(downloads(panda.use())).toEqual([]);
  });

  it('vyžádaný nenačtený pohyb nechá pandu v klidu a začne se stahovat', () => {
    for (const move of MASCOT_MOVES.filter((each) => each !== 'idle')) {
      const panda = shownPanda();
      expect(downloads(panda.play(move, 0)), move).toEqual([move]);
      expect(panda.frame(500)?.move, move).toBe('idle');
    }
  });

  it('nenačtený pohyb vyžádaný během jiného pohybu vrátí pandu do klidu', () => {
    const panda = shownPanda();
    panda.prepare('joy');
    panda.loaded('joy');
    panda.play('joy', 0);
    panda.play('encourage', 500);
    expect(panda.frame(500)).toEqual({ move: 'idle', frame: 0 });
  });

  it('pohyb se po dočtení dodatečně nepřehraje', () => {
    const panda = shownPanda();
    panda.play('joy', 0);
    panda.loaded('joy');
    panda.update(200);
    expect(panda.frame(200)?.move).toBe('idle');
    panda.play('joy', 300);
    expect(panda.frame(300)).toEqual({ move: 'joy', frame: 0 });
  });

  it('stahující se pohyb se při dalším vyžádání nestahuje podruhé', () => {
    const panda = shownPanda();
    expect(downloads(panda.play('think', 0))).toEqual(['think']);
    expect(downloads(panda.play('think', 100))).toEqual([]);
    expect(downloads(panda.prepare('think'))).toEqual([]);
  });

  it('po chybě stažení panda zůstane v klidu a při dalším vyžádání se stažení zkusí znovu', () => {
    const panda = shownPanda();
    panda.play('celebrate', 0);
    panda.failed('celebrate');
    expect(panda.frame(100)?.move).toBe('idle');
    expect(downloads(panda.play('celebrate', 200))).toEqual(['celebrate']);
  });

  it('po chybě stažení klidu panda není vidět a další použití klid stáhne znovu', () => {
    const panda = createMascotModel();
    panda.use();
    panda.failed('idle');
    expect(panda.frame(0)).toBeNull();
    expect(downloads(panda.use())).toEqual(['idle']);
  });

  it('dopředu připravený pohyb se po dočtení přehraje hned po vyžádání', () => {
    const panda = shownPanda();
    expect(downloads(panda.prepare('encourage'))).toEqual(['encourage']);
    panda.loaded('encourage');
    expect(downloads(panda.play('encourage', 0))).toEqual([]);
    expect(panda.frame(0)).toEqual({ move: 'encourage', frame: 0 });
  });
});

describe('#166 AC4: paměť pandy', () => {
  it(`najednou jsou dekódované nejvýš ${MAX_DECODED_MOVES} pohyby kromě klidu`, () => {
    expect(MAX_DECODED_MOVES).toBe(3);
    const orders: readonly MascotMove[][] = [
      ['joy', 'encourage', 'think', 'celebrate', 'wave'],
      ['celebrate', 'think', 'joy', 'encourage', 'joy', 'think'],
      ['wave', 'joy', 'encourage', 'think', 'celebrate', 'wave', 'joy'],
    ];
    for (const order of orders) {
      const { panda, decoded, run } = pandaWithMemory();
      let now = 0;
      for (const move of order) {
        run(panda.prepare(move));
        run(panda.play(move, now));
        now += 100;
        run(panda.update(now));
        expect(
          decodedWithoutIdle(decoded).length,
          `${order.join(', ')}: po ${move}`,
        ).toBeLessThanOrEqual(MAX_DECODED_MOVES);
      }
    }
  });

  it('klid zůstává v paměti pořád', () => {
    const { panda, decoded, run } = pandaWithMemory();
    for (const move of ['joy', 'encourage', 'think', 'celebrate', 'wave'] as const) {
      run(panda.prepare(move));
    }
    expect(decoded.has('idle')).toBe(true);
  });

  it('pohyb, který se právě přehrává, se kvůli místu neuvolní', () => {
    const { panda, decoded, run } = pandaWithMemory();
    run(panda.prepare('joy'));
    run(panda.play('joy', 0));
    for (const move of ['encourage', 'think', 'celebrate'] as const) {
      run(panda.prepare(move));
    }
    expect(decoded.has('joy')).toBe(true);
    expect(panda.frame(100)?.move).toBe('joy');
  });

  it('kvůli místu se uvolní pohyb, který se nejdéle nepoužil', () => {
    const { panda, decoded, run } = pandaWithMemory();
    run(panda.prepare('joy'));
    run(panda.prepare('encourage'));
    run(panda.prepare('think'));
    run(panda.play('joy', 0));
    run(panda.update(5000));
    run(panda.prepare('celebrate'));
    expect(decodedWithoutIdle(decoded).sort()).toEqual(['celebrate', 'joy', 'think']);
  });

  it('pozdrav se po přehrání uvolní', () => {
    const { panda, decoded, run } = pandaWithMemory();
    run(panda.prepare('wave'));
    run(panda.play('wave', 0));
    run(panda.update(1000));
    expect(decoded.has('wave')).toBe(true);
    const commands = panda.update(5000);
    expect(releases(commands)).toEqual(['wave']);
    run(commands);
    expect(decoded.has('wave')).toBe(false);
  });

  it('pozdrav přerušený jiným pohybem se také uvolní', () => {
    const { panda, decoded, run } = pandaWithMemory();
    run(panda.prepare('wave'));
    run(panda.prepare('joy'));
    run(panda.play('wave', 0));
    run(panda.play('joy', 500));
    expect(decoded.has('wave')).toBe(false);
    expect(panda.frame(500)).toEqual({ move: 'joy', frame: 0 });
  });

  it('uvolněný pozdrav se při dalším vyžádání stáhne znovu', () => {
    const { panda, run } = pandaWithMemory();
    run(panda.prepare('wave'));
    run(panda.play('wave', 0));
    run(panda.update(5000));
    expect(downloads(panda.prepare('wave'))).toEqual(['wave']);
  });

  it('po konci pandy (odchod ze scény) se uvolní všechno, co je v paměti', () => {
    const { panda, decoded, run } = pandaWithMemory();
    run(panda.prepare('joy'));
    run(panda.prepare('think'));
    run(panda.dispose());
    expect([...decoded]).toEqual([]);
    expect(panda.frame(0)).toBeNull();
  });
});
