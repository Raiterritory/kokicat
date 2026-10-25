import { test, expect } from 'bun:test';
import { displayedProgress, webAccess } from './web-effects';

test('Namu black periods close the web even while normal hours are open', () => {
  expect(webAccess(false, true, { target: true, blocked: true })).toEqual({ open: false, black: true });
});
test('Namu random hours replace the regular hours and reopen automatically', () => {
  expect(webAccess(false, false, { target: true, blocked: false }).open).toBe(true);
});
test('other players retain the regular web hours', () => {
  expect(webAccess(false, false, { target: false, blocked: false }).open).toBe(false);
});
test('Android always plays even during a Namu blackout', () => {
  expect(webAccess(true, false, { target: true, blocked: true })).toEqual({ open: true, black: false });
});
test('random displayed progress does not mutate the actual save', () => {
  const save = { coins: 120, best: 17 };
  expect(displayedProgress(save.coins, 9876)).toBe(9876);
  expect(save.coins).toBe(120);
  expect(displayedProgress(save.coins, undefined)).toBe(120);
});