// Prueba de Koki Adventure sin pantalla: Koki camina por el barrio (buscando el camino bloque a bloque) y
// cumple el encargo de Gufi: hablar con Gufi, juntar los dos pastelitos escondidos, sacarle el tercero al
// Taz y volver donde Gufi.
import { expect, test } from "bun:test";
import { newWorld, stepWorld, nearby, TILE } from "./world";

const SOLID = new Set(["b", "w", "n", "T", "H", "s"]);
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
      if (wd.npcs.some((n) => Math.floor(n.x / TILE) === nx && Math.floor(n.y / TILE) === ny))
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
  for (const [x, y] of route(wd, tx, ty)) {
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
});
