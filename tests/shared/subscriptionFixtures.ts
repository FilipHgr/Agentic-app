import type { SubscriptionSource } from '../../src/shared/logic/gameAccess';

/**
 * Zkušební zdroje stavu předplatného (#74, AC2–AC4). Jsou jen v testech:
 * hotová hra zná jen místní zdroj „vše odemčeno“.
 */

/** Zdroj s pevně daným stavem, kterým test může během hraní pohnout. */
export interface ChangingSource extends SubscriptionSource {
  set(state: unknown): void;
}

export function changingSource(initial: unknown): ChangingSource {
  let state = initial;
  return {
    currentState: () => state,
    set: (next) => {
      state = next;
    },
  };
}

export const ACTIVE_SOURCE: SubscriptionSource = { currentState: () => 'active' };

export const INACTIVE_SOURCE: SubscriptionSource = { currentState: () => 'inactive' };

/** Zdroj selže: při dotazu na stav vyhodí výjimku. */
export const FAILING_SOURCE: SubscriptionSource = {
  currentState: () => {
    throw new Error('obchod nefunguje');
  },
};

/** Zdroj vrací nesmysly; test je projde všechny. */
export const NONSENSE_STATES: ReadonlyArray<readonly [string, unknown]> = [
  ['velká písmena', 'ACTIVE'],
  ['mezera navíc', ' active'],
  ['prázdný text', ''],
  ['číslo', 1],
  ['true', true],
  ['null', null],
  ['objekt', { state: 'active' }],
  ['pole', ['active']],
];

export function nonsenseSource(state: unknown): SubscriptionSource {
  return { currentState: () => state };
}

/** Zdroj ještě neodpověděl: stav zatím nezná, nebo odpověď teprve přijde. */
export const PENDING_SOURCES: ReadonlyArray<readonly [string, SubscriptionSource]> = [
  ['stav „pending“', { currentState: () => 'pending' }],
  ['bez stavu (undefined)', { currentState: () => undefined }],
  ['odpověď, která ještě nepřišla', { currentState: () => new Promise(() => undefined) }],
];

/** Všechny zdroje, při kterých je předplatné neaktivní nebo jeho stav neznámý. */
export const NOT_ACTIVE_SOURCES: ReadonlyArray<readonly [string, SubscriptionSource]> = [
  ['neaktivní', INACTIVE_SOURCE],
  ['selhání', FAILING_SOURCE],
  ...NONSENSE_STATES.map(([name, state]) => [`nesmysl (${name})`, nonsenseSource(state)] as const),
  ...PENDING_SOURCES.map(([name, source]) => [`ještě neodpověděl (${name})`, source] as const),
];
