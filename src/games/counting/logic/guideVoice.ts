/**
 * Hlas průvodce nastavením (#51): kdy která věta zazní, kdy skončí a co se
 * stáhne. Čistý stavový automat bez prohlížeče: dostává události (otevření,
 * ťuknutí, načteno, chyba, pozadí a návrat) a vrací příkazy pro přehrávač.
 *
 * Pravidla:
 * - Po otevření se nic neozve; zvuk odemkne až první ťuknutí (Safari).
 * - Při příchodu na krok zazní jeho věta; nahrávka se stáhne, pokud ještě
 *   není, a přednačte se věta dalšího kroku.
 * - Úspěšně stažená nahrávka se už znovu nestahuje, nepovedená se zkusí
 *   znovu jen při příchodu na její krok, reproduktorem na jejím kroku
 *   nebo přednačtením z kroku před ní.
 * - Pozdě načtená věta zazní, jen když je rodič pořád na jejím kroku
 *   a stránka je vidět.
 */

import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';
import { GUIDE_SCRIPT } from './guideScript';
import type { GuideLineId } from './guideScript';
import type { GuideStep } from './setupGuide';

export type GuideVoiceTapTarget =
  'speaker' | 'next' | 'back' | 'option' | 'startPlaying' | 'elsewhere';

export type GuideVoiceEvent =
  | { readonly kind: 'opened' }
  /** `step` je krok průvodce po zpracování ťuknutí. */
  | { readonly kind: 'tapped'; readonly target: GuideVoiceTapTarget; readonly step: GuideStep }
  /** „Začít hrát“ prošlo a průvodce se zavřel. */
  | { readonly kind: 'closed' }
  | { readonly kind: 'loaded'; readonly id: GuideLineId }
  | { readonly kind: 'loadFailed'; readonly id: GuideLineId }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'shown' };

export type GuideVoiceCommand =
  | { readonly kind: 'unlock' }
  | { readonly kind: 'load'; readonly id: GuideLineId }
  | { readonly kind: 'play'; readonly id: GuideLineId }
  | { readonly kind: 'stop' };

type LoadStatus = 'none' | 'loading' | 'loaded' | 'failed';

export interface GuideVoiceState {
  readonly phase: 'beforeOpen' | 'open' | 'closed';
  readonly step: GuideStep;
  readonly unlocked: boolean;
  readonly tappedOnce: boolean;
  readonly hidden: boolean;
  readonly loads: Readonly<Record<GuideLineId, LoadStatus>>;
  /** Věta, která má zaznít, až se načte; `null`, když se na nic nečeká. */
  readonly waitingFor: GuideLineId | null;
}

export interface GuideVoiceResult {
  readonly state: GuideVoiceState;
  readonly commands: readonly GuideVoiceCommand[];
}

/**
 * Nahrávka věty jako vlastní soubor hry v jazyce průvodce
 * (`public/voice/<jazyk>/counting/guide/`, #65).
 */
export function guideVoiceUrl(id: GuideLineId, language: Language = currentLanguage()): string {
  return `voice/${language}/counting/guide/${id}.mp3`;
}

/** Hlas před otevřením průvodce: nic nestahuje, nic nehraje. */
export function createGuideVoice(): GuideVoiceState {
  const loads = Object.fromEntries(GUIDE_SCRIPT.map((line) => [line.id, 'none'])) as Record<
    GuideLineId,
    LoadStatus
  >;
  return {
    phase: 'beforeOpen',
    step: 1,
    unlocked: false,
    tappedOnce: false,
    hidden: false,
    loads,
    waitingFor: null,
  };
}

/** Reproduktor pulzuje, dokud rodič v otevřeném průvodci poprvé neťukne. */
export function speakerPulses(state: GuideVoiceState): boolean {
  return state.phase === 'open' && !state.tappedOnce;
}

export function handleGuideVoice(state: GuideVoiceState, event: GuideVoiceEvent): GuideVoiceResult {
  if (state.phase === 'closed') {
    return { state, commands: [] };
  }
  if (event.kind === 'opened') {
    return state.phase === 'beforeOpen'
      ? arriveAtStep({ ...state, phase: 'open' }, 1, false)
      : unchanged(state);
  }
  if (state.phase !== 'open') {
    return unchanged(state);
  }
  switch (event.kind) {
    case 'tapped':
      return handleTap(state, event.target, event.step);
    case 'closed':
      return {
        state: { ...state, phase: 'closed', waitingFor: null },
        commands: [{ kind: 'stop' }],
      };
    case 'loaded':
      return handleLoaded(state, event.id);
    case 'loadFailed':
      return {
        state: {
          ...withLoad(state, event.id, 'failed'),
          waitingFor: state.waitingFor === event.id ? null : state.waitingFor,
        },
        commands: [],
      };
    case 'hidden':
      return { state: { ...state, hidden: true, waitingFor: null }, commands: [{ kind: 'stop' }] };
    case 'shown':
      return unchanged({ ...state, hidden: false });
  }
}

function handleTap(
  state: GuideVoiceState,
  target: GuideVoiceTapTarget,
  step: GuideStep,
): GuideVoiceResult {
  const unlockCommands: GuideVoiceCommand[] = state.unlocked ? [] : [{ kind: 'unlock' }];
  const tapped: GuideVoiceState = { ...state, unlocked: true, tappedOnce: true };

  let result: GuideVoiceResult;
  if (target === 'speaker') {
    result = requestLine(tapped, lineOfStep(tapped.step));
  } else if ((target === 'next' || target === 'back') && step !== tapped.step) {
    result = arriveAtStep(tapped, step, true);
  } else {
    // Volba, prázdné místo nebo „Začít hrát“ během pojistky: hlas beze změny.
    result = unchanged(tapped);
  }
  return { state: result.state, commands: [...unlockCommands, ...result.commands] };
}

/** Příchod na krok: stáhne jeho větu a přednačte další, s odemčeným zvukem ji přehraje. */
function arriveAtStep(state: GuideVoiceState, step: GuideStep, speak: boolean): GuideVoiceResult {
  const line = lineOfStep(step);
  let current: GuideVoiceState = { ...state, step, waitingFor: null };
  const commands: GuideVoiceCommand[] = [];

  if (speak) {
    const requested = requestLine(current, line);
    current = requested.state;
    commands.push(...requested.commands);
  } else {
    const loading = startLoad(current, line);
    current = loading.state;
    commands.push(...loading.commands);
  }
  const following = nextLine(step);
  if (following !== null) {
    const preloading = startLoad(current, following);
    current = preloading.state;
    commands.push(...preloading.commands);
  }
  return { state: current, commands };
}

/** Rodič chce slyšet větu: načtená hned zazní, jinak se počká na načtení. */
function requestLine(state: GuideVoiceState, line: GuideLineId): GuideVoiceResult {
  if (state.loads[line] === 'loaded') {
    return { state: { ...state, waitingFor: null }, commands: [{ kind: 'play', id: line }] };
  }
  const loading = startLoad({ ...state, waitingFor: line }, line);
  return { state: loading.state, commands: [{ kind: 'stop' }, ...loading.commands] };
}

/** Začne stahovat nahrávku, pokud ještě není stažená ani se nestahuje. */
function startLoad(state: GuideVoiceState, line: GuideLineId): GuideVoiceResult {
  const status = state.loads[line];
  if (status === 'loaded' || status === 'loading') {
    return unchanged(state);
  }
  return { state: withLoad(state, line, 'loading'), commands: [{ kind: 'load', id: line }] };
}

function handleLoaded(state: GuideVoiceState, line: GuideLineId): GuideVoiceResult {
  const loaded = withLoad(state, line, 'loaded');
  const shouldSpeak =
    loaded.waitingFor === line && !loaded.hidden && lineOfStep(loaded.step) === line;
  if (!shouldSpeak) {
    return unchanged(loaded);
  }
  return { state: { ...loaded, waitingFor: null }, commands: [{ kind: 'play', id: line }] };
}

function withLoad(state: GuideVoiceState, line: GuideLineId, status: LoadStatus): GuideVoiceState {
  return { ...state, loads: { ...state.loads, [line]: status } };
}

function unchanged(state: GuideVoiceState): GuideVoiceResult {
  return { state, commands: [] };
}

/** Věta kroku podle scénáře. */
function lineOfStep(step: GuideStep): GuideLineId {
  return GUIDE_SCRIPT.find((line) => line.step === step)?.id ?? 'summary';
}

/** Věta následujícího kroku, nebo `null` za shrnutím. */
function nextLine(step: GuideStep): GuideLineId | null {
  return GUIDE_SCRIPT.find((line) => line.step === step + 1)?.id ?? null;
}
