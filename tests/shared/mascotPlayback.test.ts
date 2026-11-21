import { describe, expect, it } from 'vitest';

import {
  MASCOT_FRAME_COUNT,
  MASCOT_FRAMES_PER_SECOND,
  MASCOT_MOVES,
  createMascotModel,
  moveDurationMs,
} from '../../src/shared/logic/mascot';
import type { MascotModel, MascotMove } from '../../src/shared/logic/mascot';

/**
 * Testy k #166 AC2: čistá logika pandy určí snímek v čase. Klid se opakuje
 * dokola, ostatní pohyby se přehrají jednou a panda se vrátí do klidu. Nový
 * pohyb (i stejný znovu) začne hned od prvního snímku. Čas 0 nebo záporný
 * ukáže první snímek, velký skok času (návrat z pozadí) skončí v klidu.
 */

const FRAME_MS = 1000 / MASCOT_FRAMES_PER_SECOND;
const ONE_SHOT_MOVES: readonly MascotMove[] = MASCOT_MOVES.filter((move) => move !== 'idle');

/** Panda, která má stažený klid a pohyby `moves`. */
function pandaWith(...moves: MascotMove[]): MascotModel {
  const panda = createMascotModel();
  panda.use();
  panda.loaded('idle');
  for (const move of moves) {
    panda.prepare(move);
    panda.loaded(move);
  }
  return panda;
}

describe('#166 AC2: snímek pandy v čase', () => {
  it('každý pohyb má 37 snímků po 12 snímcích za sekundu', () => {
    expect(MASCOT_FRAME_COUNT).toBe(37);
    expect(moveDurationMs()).toBeCloseTo((37 / 12) * 1000);
  });

  it('klid se opakuje dokola: po posledním snímku přijde zase první', () => {
    const panda = pandaWith();
    panda.play('idle', 0);
    const lastFrameTime = (MASCOT_FRAME_COUNT - 1) * FRAME_MS + 1;
    expect(panda.frame(lastFrameTime)).toEqual({ move: 'idle', frame: MASCOT_FRAME_COUNT - 1 });
    expect(panda.frame(moveDurationMs() + 1)).toEqual({ move: 'idle', frame: 0 });
    expect(panda.frame(10 * moveDurationMs() + 2 * FRAME_MS + 1)).toEqual({
      move: 'idle',
      frame: 2,
    });
  });

  it('snímky jdou po sobě v rytmu 12 za sekundu', () => {
    const panda = pandaWith('joy');
    panda.play('joy', 1000);
    for (let frame = 0; frame < MASCOT_FRAME_COUNT; frame += 1) {
      expect(panda.frame(1000 + frame * FRAME_MS + 1), `snímek ${frame}`).toEqual({
        move: 'joy',
        frame,
      });
    }
  });

  it('pohyb kromě klidu se přehraje jednou a panda se vrátí do klidu od jeho prvního snímku', () => {
    for (const move of ONE_SHOT_MOVES) {
      const panda = pandaWith(move);
      panda.play(move, 500);
      const end = 500 + moveDurationMs();
      expect(panda.frame(end - 1), `${move}: poslední snímek`).toEqual({
        move,
        frame: MASCOT_FRAME_COUNT - 1,
      });
      expect(panda.frame(end + 1), `${move}: po konci`).toEqual({ move: 'idle', frame: 0 });
      panda.update(end + 1);
      expect(panda.currentMove(end + 1), `${move}: po konci`).toBe('idle');
    }
  });

  it('nový pohyb začne hned od prvního snímku, i když jiný ještě běží', () => {
    const panda = pandaWith('joy', 'encourage');
    panda.play('joy', 0);
    panda.play('encourage', 10 * FRAME_MS + 1);
    expect(panda.frame(10 * FRAME_MS + 1)).toEqual({ move: 'encourage', frame: 0 });
  });

  it('stejný pohyb znovu začne zase od prvního snímku', () => {
    for (const move of MASCOT_MOVES) {
      const panda = pandaWith(move);
      panda.play(move, 0);
      panda.play(move, 20 * FRAME_MS + 1);
      expect(panda.frame(20 * FRAME_MS + 1), move).toEqual({ move, frame: 0 });
    }
  });

  it('čas 0 nebo záporný ukáže první snímek', () => {
    const cases: readonly [string, number, number][] = [
      ['čas 0 od začátku', 0, 0],
      ['čas před začátkem pohybu', 1000, 400],
      ['záporný čas', 0, -500],
      ['neplatný čas', 0, Number.NaN],
    ];
    for (const [name, startedAt, now] of cases) {
      const panda = pandaWith('think');
      panda.play('think', startedAt);
      expect(panda.frame(now), name).toEqual({ move: 'think', frame: 0 });
    }
  });

  it('velký skok času (návrat z pozadí) skončí v klidu', () => {
    for (const jump of [60_000, 3_600_000, Number.POSITIVE_INFINITY]) {
      const panda = pandaWith('celebrate');
      panda.play('celebrate', 0);
      const frame = panda.frame(jump);
      expect(frame?.move, `skok ${jump} ms`).toBe('idle');
      expect(frame?.frame, `skok ${jump} ms`).toBeGreaterThanOrEqual(0);
      expect(frame?.frame, `skok ${jump} ms`).toBeLessThan(MASCOT_FRAME_COUNT);
      panda.update(jump);
      expect(panda.currentMove(jump), `skok ${jump} ms`).toBe('idle');
    }
  });
});
