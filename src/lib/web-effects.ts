export type WebEffects = { target: boolean; blocked: boolean; coins?: number; best?: number };

export function displayedProgress(actual: number, temporary: number | undefined): number {
  return typeof temporary === 'number' && Number.isFinite(temporary) ? temporary : actual;
}

// Native is evaluated first: Android never inherits web-only restrictions.
export function webAccess(native: boolean, hoursOpen: boolean, effects: WebEffects) {
  return { open: native || (effects.target ? !effects.blocked : hoursOpen), black: !native && effects.target && effects.blocked };
}