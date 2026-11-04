/**
 * Stahování rozpoznávání psaní na pozadí (#58). Vzory číslic jsou velké
 * a většina dětí odpovídá číselníkem, proto nejsou v souborech při startu.
 * Rozpoznávání se začne stahovat až po vykreslení prvního příkladu (nebo
 * když rodič zapne psaní) a stáhne se jen jednou. Když stahování selže,
 * dítě dostane číselník a u dalšího příkladu se stahování zkusí znovu.
 * Čistý TypeScript bez Phaseru; ze souboru rozpoznávání se tu berou jen typy.
 */

import type { AnswerInput, GameSettings } from './settings';
import { answerInputOf } from './settings';
import type { DigitRecognizer } from './writingRound';

/** Kde je stahování: nezačalo, běží, hotovo, nebo naposledy selhalo. */
export type RecognizerLoadStatus = 'notStarted' | 'loading' | 'ready' | 'failed';

/** Stáhne rozpoznávání; ve hře dynamický import, v testech podvržené. */
export type LoadRecognizer = () => Promise<DigitRecognizer>;

/** Dynamický import: Vite z rozpoznávání a vzorů udělá samostatný soubor. */
export const loadDigitRecognizer: LoadRecognizer = () =>
  import('./digitRecognition').then((module) => module.recognizeDigit);

export interface RecognizerLoading {
  status(): RecognizerLoadStatus;
  /** Stažené rozpoznávání, nebo `null`, dokud není. */
  recognizer(): DigitRecognizer | null;
  /** Vykreslil se příklad: první spustí stahování, po selhání každý další zkusí znovu. */
  problemDrawn(): void;
  /** Rodič zapnul psaní: když stahování ještě nezačalo, začne hned. */
  writingEnabled(): void;
  /** Hra se dozví o každé změně stavu. Vrátí funkci, která odběr zruší. */
  onChange(listener: (status: RecognizerLoadStatus) => void): () => void;
  /**
   * Čím dítě u nového příkladu odpovídá. Psaní jen tehdy, když rozpoznávání
   * je stažené nebo se poprvé stahuje (zápis počká). Po selhání číselník,
   * dokud se rozpoznávání opravdu nestáhne. Uložené nastavení se nemění.
   */
  answerInput(settings: GameSettings): AnswerInput;
}

/** Stahování rozpoznávání; `load` se zavolá nejvýš jednou na každý pokus. */
export function createRecognizerLoading(load: LoadRecognizer): RecognizerLoading {
  let status: RecognizerLoadStatus = 'notStarted';
  let recognizer: DigitRecognizer | null = null;
  /** Aspoň jeden pokus selhal: okénko se ukáže až se staženým rozpoznáváním. */
  let hasFailed = false;
  const listeners = new Set<(status: RecognizerLoadStatus) => void>();

  function setStatus(next: RecognizerLoadStatus): void {
    status = next;
    for (const listener of [...listeners]) {
      listener(next);
    }
  }

  function succeed(loaded: DigitRecognizer): void {
    recognizer = loaded;
    setStatus('ready');
  }

  function fail(): void {
    hasFailed = true;
    setStatus('failed');
  }

  function start(): void {
    setStatus('loading');
    let loading: Promise<DigitRecognizer>;
    try {
      loading = load();
    } catch {
      // Import selhal hned při spuštění: hra pokračuje s číselníkem.
      fail();
      return;
    }
    loading.then(succeed, fail);
  }

  return {
    status: () => status,
    recognizer: () => recognizer,
    problemDrawn: () => {
      if (status === 'notStarted' || status === 'failed') {
        start();
      }
    },
    writingEnabled: () => {
      if (status === 'notStarted' || status === 'failed') {
        start();
      }
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    answerInput: (settings) => {
      if (answerInputOf(settings) === 'keypad') {
        return 'keypad';
      }
      if (status === 'ready') {
        return 'writing';
      }
      return hasFailed ? 'keypad' : 'writing';
    },
  };
}
