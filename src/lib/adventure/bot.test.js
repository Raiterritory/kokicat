// Prueba de Koki Adventure sin pantalla: un jugador automático simple (corre a la derecha y salta ante
// huecos, paredes y ratas; mantiene el salto sobre los huecos para planear) tiene que llegar a la meta.
import { expect, test } from "bun:test";
import { LEVELS } from "./levels";
import { newGame, step, solidAt, TILE } from "./engine";

test("el nivel 1-1 se puede terminar", () => {
  const g = newGame(LEVELS[0]);
  let hold = 0;
  const hits = [];
  let lives = g.lives;
  for (let f = 0; f < 60 * 180 && g.state === "playing"; f++) {
    const fx = Math.floor((g.x + 30) / TILE),
      fy = Math.floor((g.y + 33) / TILE);
    let danger = false;
    for (let d = 1; d <= 2; d++) {
      if (solidAt(g, fx + d, fy) || solidAt(g, fx + d, fy - 1)) danger = true;
      if (!solidAt(g, fx + d, fy + 1)) danger = true;
    }
    for (const r of g.rats)
      if (r.alive && r.x - g.x > -10 && r.x - g.x < 130 && Math.abs(r.y - g.y) < 60) danger = true;
    /* planea sobre los huecos, pero suelta si hay donde aterrizar cerca abajo */
    let overPit = false,
      landing = false;
    for (let d = 0; d <= 2; d++) {
      let any = false;
      for (let y = fy + 1; y < g.h; y++)
        if (solidAt(g, fx + d, y)) {
          any = true;
          if (y - fy <= 3 && d <= 1) landing = true;
        }
      if (!any) overPit = true;
    }
    if (landing && g.vy > 0) overPit = false;
    if (g.onGround && danger) hold = 24;
    const jump = hold > 0 || (!g.onGround && overPit);
    if (hold > 0) hold--;
    const before = Math.round(g.x / TILE);
    step(g, { left: false, right: true, jump });
    if (g.lives !== lives) {
      hits.push(before);
      lives = g.lives;
    }
  }
  console.log(
    `estado ${g.state}, ${Math.round(g.frame / 60)} s, pastelitos ${g.pastelitos}, dorados ${g.goldens}, vidas ${g.lives}, golpes en ${hits.join(", ") || "-"}`,
  );
  expect(g.state).toBe("won");
});
