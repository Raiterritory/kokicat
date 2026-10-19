// Prueba de Koki Adventure sin pantalla: Koki camina por el barrio (buscando el camino bloque a bloque) y
// cumple el encargo de Gufi: hablar con Gufi, juntar los dos pastelitos escondidos, sacarle el tercero al
// Taz y volver donde Gufi.
import { expect, test } from "bun:test";
import { newWorld, stepWorld, nearby, nearSpot, SPOTS, TILE, PIGEONS_GOAL } from "./world";

const SOLID = new Set(["b", "w", "n", "T", "H", "s", "F", "B", "S"]);
/* el camino más corto (por bloques) hasta un punto, esquivando lo sólido */
function route(wd, tx, ty) {
  const sx = Math.floor(wd.x / TILE),
    sy = Math.floor(wd.y / TILE);
  const prev = new Map([[sx + "," + sy, null]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = nx + "," + ny;
      if (prev.has(k) || SOLID.has(wd.ground[ny]?.[nx] ?? "b")) continue;
      if (
        wd.npcs.some(
          (n) =>
            n.map === wd.map &&
            !n.hidden &&
            Math.floor(n.x / TILE) === nx &&
            Math.floor(n.y / TILE) === ny,
        )
      )
        continue;
      prev.set(k, [x, y]);
      q.push([nx, ny]);
    }
  }
  const path = [];
  for (let k = tx + "," + ty; prev.get(k); ) {
    path.unshift(k.split(",").map(Number));
    const p = prev.get(k);
    k = p[0] + "," + p[1];
  }
  return path;
}
/* camina hasta el bloque (tx, ty) apretando la cruceta */
function walkTo(wd, tx, ty) {
  const map = wd.map;
  for (const [x, y] of route(wd, tx, ty)) {
    if (wd.map !== map) return; /* pasó por una salida a otro mapa */
    const cx = x * TILE + TILE / 2,
      cy = y * TILE + TILE / 2;
    for (let f = 0; f < 200 && (Math.abs(wd.x - cx) > 1 || Math.abs(wd.y - cy) > 1); f++)
      stepWorld(
        wd,
        {
          left: wd.x > cx + 1,
          right: wd.x < cx - 1,
          up: wd.y > cy + 1,
          down: wd.y < cy - 1,
          act: false,
        },
        false,
      );
  }
}
/* hablar con quien esté al lado y pasar todas las páginas */
function talk(wd) {
  const n = nearby(wd);
  stepWorld(wd, { left: false, right: false, up: false, down: false, act: true }, true);
  const lines = wd.talk ? wd.talk.map((l) => l.text) : [];
  while (wd.talk)
    stepWorld(wd, { left: false, right: false, up: false, down: false, act: true }, true);
  return { who: n?.who, lines };
}
const tileOf = (who, wd) => {
  const n = wd.npcs.find((p) => p.who === who);
  return [Math.floor(n.x / TILE), Math.floor(n.y / TILE)];
};

test("el encargo de Gufi se puede cumplir", () => {
  const wd = newWorld();
  const [gx, gy] = tileOf("gufi", wd),
    [zx, zy] = tileOf("taz", wd);
  walkTo(wd, gx - 1, gy);
  expect(talk(wd).who).toBe("gufi");
  expect(wd.quest).toBe(1);
  /* el Taz no suelta nada antes de que encuentres los otros dos */
  walkTo(wd, zx - 1, zy);
  expect(talk(wd).who).toBe("taz");
  expect(wd.found).toBe(0);
  for (const c of wd.cakes) walkTo(wd, Math.floor(c.x / TILE), Math.floor(c.y / TILE));
  expect(wd.found).toBe(2);
  walkTo(wd, zx - 1, zy);
  talk(wd);
  expect(wd.found).toBe(3);
  walkTo(wd, gx - 1, gy);
  const end = talk(wd);
  expect(end.lines.join(" ")).toContain("mordido");
  expect(wd.quest).toBe(2);
  expect(wd.justDone).toBe(1);

  /* encargo 2: Gufi pide traer al Taz, que arranca; Koki lo persigue hasta pillarlo */
  talk(wd);
  expect(wd.quest).toBe(3);
  const taz = wd.npcs.find((n) => n.who === "taz");
  let frames = 0;
  for (; frames < 60 * 90 && wd.quest === 3; frames++) {
    /* va derecho hacia el Taz; si choca, prueba por el camino de bloques */
    const [tx, ty] = [Math.floor(taz.x / TILE), Math.floor(taz.y / TILE)];
    const step = frames % 40 < 30 ? null : route(wd, tx, ty)[0];
    const gx = step ? step[0] * TILE + TILE / 2 : taz.x,
      gy = step ? step[1] * TILE + TILE / 2 : taz.y;
    stepWorld(
      wd,
      {
        left: wd.x > gx + 1,
        right: wd.x < gx - 1,
        up: wd.y > gy + 1,
        down: wd.y < gy - 1,
        act: false,
      },
      false,
    );
  }
  console.log(`el Taz pillado en ${(frames / 60).toFixed(1)} s`);
  expect(wd.quest).toBe(4);
  while (wd.talk)
    stepWorld(wd, { left: false, right: false, up: false, down: false, act: true }, true);
  /* de vuelta donde Gufi, con el Taz detrás */
  walkTo(wd, gx - 1, gy);
  expect(Math.hypot(taz.x - wd.x, taz.y - wd.y)).toBeLessThan(60);
  const sorry = talk(wd);
  expect(sorry.lines.join(" ")).toContain("Perdón");
  expect(wd.quest).toBe(5);
  expect(wd.justDone).toBe(2);

  /* encargo 3: las escondidas del Ratón (tres veces) */
  const raton = wd.npcs.find((n) => n.who === "raton");
  const [rx, ry] = [Math.floor(raton.x / TILE), Math.floor(raton.y / TILE)];
  walkTo(wd, rx + 1, ry);
  expect(talk(wd).who).toBe("raton");
  expect(wd.quest).toBe(6);
  expect(raton.hidden).toBe(true);
  /* un rincón equivocado: un texto chistoso y nada más */
  const wrong = SPOTS.findIndex((_, i) => i !== wd.hideSpot);
  walkTo(wd, SPOTS[wrong].tx, SPOTS[wrong].ty);
  expect(nearSpot(wd)).toBe(wrong);
  expect(talk(wd).lines[0]).toBe(SPOTS[wrong].empty);
  expect(wd.hideRound).toBe(0);
  const seen = [];
  for (let round = 0; round < 3; round++) {
    const i = wd.hideSpot;
    seen.push(SPOTS[i].name);
    walkTo(wd, SPOTS[i].tx, SPOTS[i].ty);
    talk(wd);
    expect(wd.hideRound).toBe(round + 1);
  }
  console.log(`escondites: ${seen.join(", ")}`);
  expect(new Set(seen).size).toBeGreaterThan(1);
  expect(wd.quest).toBe(7);
  expect(wd.justDone).toBe(3);
  expect(raton.hidden).toBe(false);

  /* encargo 4: a la plaza por la salida del camino; la Tía pide espantar palomas a cambio de una reineta */
  walkTo(wd, 29, 9);
  expect(wd.map).toBe("plaza");
  const [px, py] = tileOf("tia", wd);
  walkTo(wd, px, py + 1);
  expect(talk(wd).who).toBe("tia");
  expect(wd.quest).toBe(8);
  let f = 0;
  for (; f < 60 * 120 && wd.quest === 8; f++) {
    /* va hacia la paloma sentada más cercana (si no hay, espera) */
    const sitting = wd.pigeons.filter((p) => p.fly === 0);
    if (!sitting.length) {
      stepWorld(wd, { left: false, right: false, up: false, down: false, act: false }, false);
      continue;
    }
    const p = sitting.reduce((a, b) =>
      Math.hypot(a.x - wd.x, a.y - wd.y) < Math.hypot(b.x - wd.x, b.y - wd.y) ? a : b,
    );
    const next = route(wd, Math.floor(p.x / TILE), Math.floor(p.y / TILE))[0];
    const gx = next ? next[0] * TILE + TILE / 2 : p.x,
      gy = next ? next[1] * TILE + TILE / 2 : p.y;
    stepWorld(
      wd,
      {
        left: wd.x > gx + 1,
        right: wd.x < gx - 1,
        up: wd.y > gy + 1,
        down: wd.y < gy - 1,
        act: false,
      },
      false,
    );
  }
  console.log(`palomas espantadas en ${(f / 60).toFixed(1)} s`);
  expect(wd.scared).toBeGreaterThanOrEqual(PIGEONS_GOAL);
  expect(wd.quest).toBe(9);
  walkTo(wd, px, py + 1);
  const end4 = talk(wd);
  expect(end4.lines.join(" ")).toContain("reineta");
  expect(wd.quest).toBe(10);
  expect(wd.justDone).toBe(4);
  /* y de vuelta al barrio por la otra salida */
  walkTo(wd, 0, 9);
  expect(wd.map).toBe("barrio");
});
