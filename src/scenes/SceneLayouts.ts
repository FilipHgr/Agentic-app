import { answerChoices, hintDotGroups } from '../logic/answerRound';
import type { AnswerRound } from '../logic/answerRound';
import {
  gameAreaFor,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  sceneryLayoutFor,
} from '../logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceSizes,
  DeviceWritingLayout,
  GameArea,
} from '../logic/deviceLayout';
import { isWritingActive } from '../logic/settings';
import type { GameSettings } from '../logic/settings';
import { STARS_PER_SET } from '../logic/stars';
import type { MascotLook } from './Mascot';

/** Co scéna právě ukazuje; podle toho se vybírá rozložení. */
export interface LayoutInputs {
  readonly gameArea: GameArea;
  readonly settings: GameSettings;
  readonly round: AnswerRound | undefined;
  readonly hintIsShown: boolean;
}

/** Velikost postavičky a jejích pohybů z rozložení. */
export function mascotLookOf(sizes: DeviceSizes): MascotLook {
  return {
    size: sizes.mascotSize,
    jumpHeight: sizes.mascotJumpHeight,
    danceSway: sizes.mascotDanceSway,
  };
}

/** Herní plocha z registru; dokud tam není, dnešní 1024 × 768. */
export function gameAreaFromRegistry(stored: unknown): GameArea {
  return isGameArea(stored) ? stored : gameAreaFor(undefined);
}

/** Je hodnota z registru herní plocha? */
function isGameArea(value: unknown): value is GameArea {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const area = value as Partial<GameArea>;
  return (
    typeof area.mode === 'string' &&
    typeof area.width === 'number' &&
    typeof area.height === 'number' &&
    typeof area.scale === 'number'
  );
}

/**
 * Rozložení obrazovky pro scénu podle herní plochy, nastavení a nápovědy.
 * Rozložení telefonu se zkouší z mnoha velikostí, proto se spočítaná pamatují.
 */
export class SceneLayouts {
  private readonly keypadLayouts = new Map<string, DeviceScreenLayout>();
  private readonly writingLayouts = new Map<string, DeviceWritingLayout>();

  /** @param readInputs Vrátí současný stav scény (čte se při každém dotazu). */
  constructor(private readonly readInputs: () => LayoutInputs) {}

  /** Zapomene spočítaná rozložení (po změně herní plochy už nebudou potřeba). */
  clear(): void {
    this.keypadLayouts.clear();
    this.writingLayouts.clear();
  }

  /** Rozložení s číselníkem. */
  keypad(): DeviceScreenLayout {
    const inputs = this.readInputs();
    const maxNumber = inputs.round?.maxNumber ?? inputs.settings.maxNumber;
    const groups = shownHintGroups(inputs);
    const key = layoutKey(inputs, 'keypad', maxNumber, groups);
    const cached = this.keypadLayouts.get(key);
    if (cached) {
      return cached;
    }
    const layout = layoutDeviceScreen(
      inputs.gameArea,
      answerChoices(maxNumber).length,
      STARS_PER_SET,
      groups,
      inputs.settings.operations,
    );
    this.keypadLayouts.set(key, layout);
    return layout;
  }

  /** Rozložení s okénky na psaní. */
  writing(): DeviceWritingLayout {
    const inputs = this.readInputs();
    const groups = shownHintGroups(inputs);
    const key = layoutKey(inputs, 'writing', inputs.settings.maxNumber, groups);
    const cached = this.writingLayouts.get(key);
    if (cached) {
      return cached;
    }
    const layout = layoutDeviceWritingScreen(
      inputs.gameArea,
      inputs.settings.maxNumber,
      STARS_PER_SET,
      groups,
      inputs.settings.operations,
    );
    this.writingLayouts.set(key, layout);
    return layout;
  }

  /** Rozložení se skutečným ovládáním: okénka na psaní, nebo číselník. */
  answer(): DeviceScreenLayout | DeviceWritingLayout {
    return isWritingActive(this.readInputs().settings) ? this.writing() : this.keypad();
  }

  /**
   * Rozložení pro hvězdičky, postavičku a příklad. Na telefonu (na šířku
   * i na výšku) rozložení se skutečným ovládáním, jinde jako dřív
   * s číselníkem (viz `sceneryLayoutFor`).
   */
  scenery(): DeviceScreenLayout | DeviceWritingLayout {
    return sceneryLayoutFor(this.readInputs().gameArea.mode, this.keypad(), this.answer());
  }
}

/** Klíč spočítaného rozložení: ovládání, plocha, rozsah, druh příkladů a nápověda. */
function layoutKey(
  inputs: LayoutInputs,
  input: string,
  maxNumber: number,
  groups: readonly number[],
): string {
  const { mode, width, height } = inputs.gameArea;
  const { operations } = inputs.settings;
  return [input, mode, width, height, maxNumber, operations, groups.join('+')].join('|');
}

/** Skupinky teček, pro které má rozložení udělat místo (na telefonu, #54). */
function shownHintGroups(inputs: LayoutInputs): number[] {
  return inputs.round && inputs.hintIsShown ? hintDotGroups(inputs.round.problem) : [];
}
