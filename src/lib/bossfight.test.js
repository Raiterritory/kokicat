// Pruebas del jefe sin pantalla: las bombas avisan, vuelan hacia donde estabas y se pueden esquivar.
import { expect, test } from "bun:test";
import { BOSS_HINTS, BOSS_KINDS, bossHits, createBoss, updateBoss } from "./bossfight";

const W = 1066;
const H = 600;
const GROUND = 40;

const bomb = (over = {}) => ({
  x0: 900,
  y0: 300,
  x: 450,
  y: 300,
  tx: 450,
  ty: 300,
  t: 60,
  ...over,
});

test("cada jefe tiene su pista de ataque", () => {
  for (const kind of BOSS_KINDS) expect(BOSS_HINTS[kind].length).toBeGreaterThan(0);
});

test("la bomba avisa antes de poder golpear", () => {
  const boss = createBoss(W, H, "bombas");
  boss.bombs.push(bomb({ t: 10 }));
  expect(bossHits(boss, 450, 300, 26)).toBe(false);
  boss.bombs[0].t = 60;
  expect(bossHits(boss, 450, 300, 26)).toBe(true);
});

test("la bomba se esquiva moviéndose del blanco", () => {
  const boss = createBoss(W, H, "bombas");
  boss.bombs.push(bomb({ t: 60 }));
  expect(bossHits(boss, 450, 120, 26)).toBe(false);
});

test("el jefe de bombas dispara y la bomba llega a donde estabas", () => {
  const boss = createBoss(W, H, "bombas");
  let launched = false;
  let hit = false;
  for (let f = 0; f < 260; f++) {
    updateBoss(boss, {
      width: W,
      height: H,
      groundHeight: GROUND,
      playerX: 450,
      playerY: 300,
      playerVelocity: 0,
      rnd: () => 0.5,
    });
    if (boss.bombs.length) launched = true;
    if (bossHits(boss, 450, 300, 26)) hit = true;
  }
  expect(launched).toBe(true);
  expect(hit).toBe(true);
});

test("el jefe termina cuando se va y ya no queda nada en el aire", () => {
  const boss = createBoss(W, H, "rayo");
  let finished = false;
  for (let f = 0; f < 1100 && !finished; f++) {
    const st = updateBoss(boss, {
      width: W,
      height: H,
      groundHeight: GROUND,
      playerX: 450,
      playerY: 300,
      playerVelocity: 0,
      rnd: () => 0.5,
    });
    finished = st.finished;
  }
  expect(finished).toBe(true);
});
