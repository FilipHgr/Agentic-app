/**
 * Telefon na výšku podle návrhu P2 (#56) v herních jednotkách. Plán v CSS px
 * je v `phonePortraitPlan.ts`, převod na jednotky v `phoneScreenParts.ts`.
 * Čistý TypeScript.
 */

import type { GameSize } from '../../../shared/logic/viewportLayout';
import type { PhoneScreenLayout, PhoneWritingLayout } from './deviceLayout';
import type { Region } from './phoneHint';
import { HINT_GROUP_GAP, placePortraitHint } from './phonePortraitHint';
import { planPhonePortrait } from './phonePortraitPlan';
import type { PortraitLayoutSettings, PortraitPlan } from './phonePortraitPlan';
import type { PhonePlanRequest } from './phonePlan';
import {
  areaInUnits,
  cssSizeOf,
  phoneParts,
  regionInUnits,
  slotInUnits,
  units,
} from './phoneScreenParts';
import type { ButtonSlot, HintDot } from './screenLayout';

export type { PortraitLayoutSettings } from './phonePortraitPlan';

/** Rozložení na výšku má navíc vyhrazené místo pro nápovědu (v herních jednotkách). */
interface PortraitParts {
  readonly hintRegion: Region;
}

export interface PhonePortraitScreenLayout extends PhoneScreenLayout, PortraitParts {}
export interface PhonePortraitWritingLayout extends PhoneWritingLayout, PortraitParts {}

export type PhonePortraitLayout = PhonePortraitScreenLayout | PhonePortraitWritingLayout;

/** Je to rozložení na výšku, které má místo pro nápovědu vyhrazené? */
export function isPortraitLayout(layout: object): layout is PhonePortraitLayout {
  return 'hintRegion' in layout;
}

/**
 * Zadání plánu. Nápověda v něm není: místo pro ni je vyhrazené vždy
 * a tečky dopočítá `layoutPhonePortraitHint`.
 */
function portraitRequest(
  area: GameSize,
  settings: PortraitLayoutSettings,
  answerInput: 'keypad' | 'writing',
  starCount: number,
): PhonePlanRequest {
  return {
    free: cssSizeOf(area),
    maxNumber: settings.maxNumber,
    answerInput,
    starCount,
    hintGroups: [],
  };
}

function portraitParts(plan: PortraitPlan, request: PhonePlanRequest) {
  return {
    ...phoneParts({ ...plan, hintDots: [] }, request),
    hintRegion: regionInUnits(plan.hintRegion),
  };
}

/** Telefon na výšku s číselníkem (P2). */
export function layoutPhonePortraitScreen(
  area: GameSize,
  settings: PortraitLayoutSettings,
  starCount = 0,
): PhonePortraitScreenLayout {
  const request = portraitRequest(area, settings, 'keypad', starCount);
  const plan = planPhonePortrait(request, settings);
  return { ...portraitParts(plan, request), answerButtons: plan.answerButtons.map(slotInUnits) };
}

/** Telefon na výšku s psaním (P2): okénka vedle sebe, pod nimi smazání a ✓. */
export function layoutPhonePortraitWritingScreen(
  area: GameSize,
  settings: PortraitLayoutSettings,
  starCount = 0,
): PhonePortraitWritingLayout {
  const request = portraitRequest(area, settings, 'writing', starCount);
  const plan = planPhonePortrait(request, settings);
  const noButton: ButtonSlot = { x: 0, y: 0, size: 0 };
  return {
    ...portraitParts(plan, request),
    writingAreas: (plan.writing?.areas ?? []).map(areaInUnits),
    clearButton: slotInUnits(plan.writing?.clear ?? noButton),
    confirmButton: slotInUnits(plan.writing?.confirm ?? noButton),
  };
}

/** Tečky nápovědy ve vyhrazeném místě; ostatní prvky se neposunou (AC5). */
export function layoutPhonePortraitHint(
  layout: PhonePortraitLayout,
  groups: readonly number[],
): HintDot[] {
  const grid = { cell: layout.hintStyle.spacing, groupGap: units(HINT_GROUP_GAP) };
  return placePortraitHint(groups, grid, layout.hintRegion);
}
