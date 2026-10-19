// Koki Adventure: el barrio de Koki visto desde arriba, la pandilla y el primer encargo. Sin dibujos: solo el
// mapa, quién está dónde, el movimiento de Koki, con quién se puede hablar y qué dice cada uno según el encargo.
//
// El mapa es texto (una letra = un bloque de 16x16), así lo pueden leer también las consolas:
//   g pasto   f flores   p camino   w agua   b arbusto (borde)   n reja   T árbol (2x2)   H casa (4x3)   s letrero
//   K donde parte Koki   G Gufi   R el Ratón   Z el Taz   c un pastelito escondido
export const TILE = 16;

export const BARRIO = [
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bggHHHHgggggggggggggggTTgggggb",
  "bggHHHHgfggggffggggTTgTTgTTggb",
  "bgfHHHHgsgfgggggggfTTgfggTTggb",
  "bggggpggggggfggggggggggggggfgb",
  "bggggKgggggfggggggggggZgggggfb",
  "bggggpggfgggggfggnnnnnnnnnnngb",
  "bgggfpgggggggggggfggfggggggggb",
  "bgffgpggGggggggggggggggfgggggb",
  "bppppppppppppppppppppppppppppb",
  "bggffgggggggfgggpggggggggggggb",
  "bggRggggggggggfgpggfgggggfgggb",
  "bgggfggggggfggggpgggggggTTgggb",
  "bgggggggggggggggpggfggggTTgggb",
  "bwwwwwwgggfTTgfgpgggggggggcggb",
  "bwwwwwwggggTTggfpgggTTgggggTTb",
  "bwwwwwwcggggggggpfggTTgggggTTb",
  "bwwwwwwgggggggggpggggggggggggb",
  "bwwwwwwgggggggggfggggggggfgggb",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
];

export type Who = "gufi" | "raton" | "taz";
export type Npc = { who: Who; x: number; y: number };
export type Cake = { x: number; y: number; taken: boolean };
export type Line = { who: Who | "koki" | "nadie"; text: string };
/*
 * en qué va la historia:
 *   encargo 1, "Los pastelitos de Gufi": 0 sin empezar, 1 buscando, 2 terminado
 *   encargo 2, "Pilla al Taz":           3 persiguiéndolo, 4 te sigue de vuelta donde Gufi, 5 terminado
 */
export type World = {
  w: number;
  h: number;
  ground: string[];
  x: number;
  y: number;
  face: -1 | 1;
  moving: boolean;
  frame: number;
  npcs: Npc[];
  cakes: Cake[];
  quest: number;
  justDone: number; /* el encargo que se acaba de cumplir (para el cartel), o 0 */
  found: number;
  tazRest: number; /* el Taz descansa (se cansa cada tanto al arrancar) */
  tazRun: number;
  tazStuck: number;
  tazGave: boolean;
  tazAsked: number;
  talk: Line[] | null;
  page: number;
  events: string[];
};

const SOLID = new Set(["b", "w", "n", "T", "H", "s"]);
const SPEED = 1.15;
const TAZ_SPEED = 1.0; /* un poco más lento que Koki: se pilla acorralándolo */
const TAZ_SEES = 80; /* desde qué distancia arranca */
const BODY = 10; /* el cuerpo de Koki para chocar (los pies, 10x6 puntos) */

export function newWorld(): World {
  const h = BARRIO.length,
    w = BARRIO[0].length;
  const wd: World = {
    w,
    h,
    ground: [],
    x: 0,
    y: 0,
    face: 1,
    moving: false,
    frame: 0,
    npcs: [],
    cakes: [],
    quest: 0,
    justDone: 0,
    found: 0,
    tazRest: 0,
    tazRun: 0,
    tazStuck: 0,
    tazGave: false,
    tazAsked: 0,
    talk: null,
    page: 0,
    events: [],
  };
  for (let ty = 0; ty < h; ty++) {
    let row = "";
    for (let tx = 0; tx < w; tx++) {
      const c = BARRIO[ty][tx];
      const cx = tx * TILE + TILE / 2,
        cy = ty * TILE + TILE / 2;
      if (c === "K") {
        wd.x = cx;
        wd.y = cy;
        row += "p";
      } else if (c === "G") {
        wd.npcs.push({ who: "gufi", x: cx, y: cy });
        row += "g";
      } else if (c === "R") {
        wd.npcs.push({ who: "raton", x: cx, y: cy });
        row += "g";
      } else if (c === "Z") {
        wd.npcs.push({ who: "taz", x: cx, y: cy });
        row += "g";
      } else if (c === "c") {
        wd.cakes.push({ x: cx, y: cy, taken: false });
        row += "g";
      } else row += c;
    }
    wd.ground.push(row);
  }
  return wd;
}

const solidAt = (wd: World, px: number, py: number) => {
  const tx = Math.floor(px / TILE),
    ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= wd.w || ty >= wd.h) return true;
  return SOLID.has(wd.ground[ty][tx]);
};
/* ¿unos pies en (x, y) chocan con algo? (bloques sólidos o alguien más de la pandilla) */
function blockedBy(wd: World, x: number, y: number, self: Npc | null) {
  const x0 = x - BODY / 2,
    x1 = x + BODY / 2,
    y0 = y + 1,
    y1 = y + 7;
  if (solidAt(wd, x0, y0) || solidAt(wd, x1, y0) || solidAt(wd, x0, y1) || solidAt(wd, x1, y1))
    return true;
  /* el Taz que te sigue no estorba */
  return wd.npcs.some(
    (n) =>
      n !== self &&
      !(n.who === "taz" && wd.quest === 4) &&
      Math.abs(n.x - x) < 12 &&
      Math.abs(n.y - y) < 9,
  );
}
const blocked = (wd: World, x: number, y: number) => blockedBy(wd, x, y, null);
const tazOf = (wd: World) => wd.npcs.find((n) => n.who === "taz")!;
/* mover a alguien de la pandilla (choca igual que Koki, y tampoco atraviesa a Koki) */
function moveNpc(wd: World, n: Npc, dx: number, dy: number) {
  const hitsKoki = (x: number, y: number) =>
    wd.quest !== 4 && Math.abs(wd.x - x) < 12 && Math.abs(wd.y - y) < 9;
  let moved = false;
  if (dx && !blockedBy(wd, n.x + dx, n.y, n) && !hitsKoki(n.x + dx, n.y)) {
    n.x += dx;
    moved = true;
  }
  if (dy && !blockedBy(wd, n.x, n.y + dy, n) && !hitsKoki(n.x, n.y + dy)) {
    n.y += dy;
    moved = true;
  }
  return moved;
}

/* el Taz arranca de Koki: de las 8 direcciones elige la que más lo aleja (y a ratos se cansa) */
function tazFlees(wd: World) {
  const t = tazOf(wd);
  const d = Math.hypot(t.x - wd.x, t.y - wd.y);
  if (d < 15) {
    wd.quest = 4;
    wd.talk = [
      { who: "taz", text: "¡Ya, ya! Me pillaste. Voy a pedir perdón… pero no me mirí." },
      { who: "nadie", text: "🐈‍⬛ El Taz te sigue, arrastrando las patas." },
    ];
    wd.page = 0;
    wd.events.push("caught");
    return;
  }
  if (wd.tazRest > 0) {
    wd.tazRest--;
    return;
  }
  if (d > TAZ_SEES) return;
  if (++wd.tazRun > 220) {
    wd.tazRun = 0;
    wd.tazRest = 60;
    wd.events.push("tired");
    return;
  }
  let best: [number, number] | null = null,
    bd = -1;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      dx = Math.cos(a) * TAZ_SPEED,
      dy = Math.sin(a) * TAZ_SPEED;
    if (blockedBy(wd, t.x + dx, t.y + dy, t)) continue;
    const nd = Math.hypot(t.x + dx - wd.x, t.y + dy - wd.y);
    if (nd > bd) {
      bd = nd;
      best = [dx, dy];
    }
  }
  if (best && bd > d - 0.2) moveNpc(wd, t, best[0], best[1]);
}
/* el Taz pillado camina detrás de Koki (si se queda pegado, aparece al lado) */
function tazFollows(wd: World) {
  const t = tazOf(wd);
  const tx = wd.x - wd.face * 16,
    ty = wd.y;
  const d = Math.hypot(tx - t.x, ty - t.y);
  if (d < 6) {
    wd.tazStuck = 0;
    return;
  }
  const sp = Math.min(1.4, d / 6);
  if (!moveNpc(wd, t, ((tx - t.x) / d) * sp, ((ty - t.y) / d) * sp)) wd.tazStuck++;
  if (wd.tazStuck > 90 || d > 120) {
    t.x = wd.x;
    t.y = wd.y;
    wd.tazStuck = 0;
  }
}

/* quién está lo bastante cerca para hablarle */
export function nearby(wd: World): Npc | null {
  let best: Npc | null = null,
    bd = 30;
  for (const n of wd.npcs) {
    const d = Math.hypot(n.x - wd.x, n.y - wd.y);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

/* lo que dice cada uno, según cómo va el encargo */
function linesFor(wd: World, who: Who): Line[] {
  if (who === "gufi") {
    if (wd.quest === 0) {
      wd.quest = 1;
      wd.events.push("quest");
      return [
        {
          who: "gufi",
          text: "¡Koki, weón! Se me perdieron los pastelitos pa' la once y el Taz anda con cara de culpable…",
        },
        {
          who: "gufi",
          text: "Eran tres. ¿Me ayudai a buscarlos por el barrio? Te convido uno, palabra de perro.",
        },
        { who: "koki", text: "Miau. (Koki acepta el encargo.)" },
      ];
    }
    if (wd.quest === 1 && wd.found < 3)
      return [{ who: "gufi", text: `Llevai ${wd.found} de 3… la once no se hace sola, po.` }];
    if (wd.quest === 1) {
      wd.quest = 2;
      wd.justDone = 1;
      wd.events.push("done");
      return [
        { who: "gufi", text: "¡Bacán, Koki! Ahora sí hay once." },
        { who: "gufi", text: "…¿Y por qué este está mordido? 🤨" },
        { who: "taz", text: "(Desde la reja) Miau. Yo no fui." },
      ];
    }
    if (wd.quest === 2) {
      wd.quest = 3;
      wd.events.push("quest");
      return [
        {
          who: "gufi",
          text: "Ya, la once está lista… pero el Taz me debe una disculpa por el pastelito mordido.",
        },
        { who: "gufi", text: "Tráemelo, Koki. Ojo que corre más que micro en bajada." },
        { who: "koki", text: "Miau. (Koki se estira y se prepara.)" },
      ];
    }
    if (wd.quest === 3)
      return [{ who: "gufi", text: "¿Y el Taz? Anda a pillarlo, po. Está por la reja." }];
    if (wd.quest === 4) {
      wd.quest = 5;
      wd.justDone = 2;
      wd.events.push("done");
      return [
        { who: "taz", text: "Perdón, Gufi… el pastelito me miró feo. No fue mi culpa." },
        { who: "gufi", text: "Ya po, te perdono. Pero la próxima me convidai la mitad." },
        { who: "taz", text: "La mitad de la mitad." },
        { who: "gufi", text: "Trato hecho. 🐾" },
      ];
    }
    return [{ who: "gufi", text: "Tamos todos en paz. Por ahora." }];
  }
  if (who === "raton") {
    if (wd.quest === 0)
      return [{ who: "raton", text: "Gufi anda llorando por algo. Anda a ver qué le pasa." }];
    if (wd.quest === 1)
      return [
        {
          who: "raton",
          text: "¿Pastelitos? Vi uno al lado del estanque y otro entre los árboles de abajo.",
        },
        {
          who: "raton",
          text: "Y el Taz anda con la boca llena de crema… yo no digo na', pero digo.",
        },
      ];
    if (wd.quest === 3)
      return [
        { who: "raton", text: "¿Pillar al Taz? Es rápido, pero se cansa harto." },
        {
          who: "raton",
          text: "Acorrálalo contra la reja, los árboles o el estanque. Ahí no tiene pa' dónde.",
        },
      ];
    if (wd.quest === 4)
      return [{ who: "raton", text: "Jajaja, mírenlo, todo humillado. Grabando pa' TikTok." }];
    return [{ who: "raton", text: "Me guardaron un pedacito, ¿cierto? ¿Cierto?" }];
  }
  /* el Taz */
  if (wd.quest === 2) return [{ who: "taz", text: "Miau. (Se hace el leso.)" }];
  if (wd.quest === 3) return [{ who: "taz", text: "¡No me pillai, gil!" }];
  if (wd.quest === 4) return [{ who: "taz", text: "Ya, ya, voy… no me apurí." }];
  if (wd.quest >= 5) return [{ who: "taz", text: "Miau. (Ofendido, pero en paz.)" }];
  if (wd.quest !== 1) return [{ who: "taz", text: "Miau. (Te mira raro.)" }];
  if (wd.tazGave) return [{ who: "taz", text: "Ya te lo pasé, ¿qué más querí?" }];
  if (wd.found < 2) {
    wd.tazAsked++;
    return [
      {
        who: "taz",
        text:
          wd.tazAsked > 1
            ? "Que no sé na', te dije. (Se lame los bigotes.)"
            : "¿Pastelitos? Yo no sé na'. (Se limpia la crema de los bigotes.)",
      },
    ];
  }
  wd.tazGave = true;
  wd.found++;
  wd.events.push("cake");
  return [
    {
      who: "taz",
      text: "Ya po, ya… me comí la mitad de uno. Estaba en la reja, solito, pidiendo que alguien lo salvara.",
    },
    { who: "nadie", text: "🧁 El Taz te pasa un pastelito mordido." },
  ];
}

export type Pad = { up: boolean; down: boolean; left: boolean; right: boolean; act: boolean };

/* un paso (60 por segundo). act = se acaba de apretar el botón de acción */
export function stepWorld(wd: World, pad: Pad, act: boolean) {
  wd.events = [];
  wd.frame++;
  if (wd.talk) {
    if (act) {
      wd.page++;
      if (wd.page >= wd.talk.length) {
        wd.talk = null;
        wd.page = 0;
      }
    }
    return;
  }
  /* caminar (en diagonal, a la misma velocidad) */
  let dx = (pad.right ? 1 : 0) - (pad.left ? 1 : 0),
    dy = (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
  if (dx && dy) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  wd.moving = !!(dx || dy);
  if (wd.quest === 3) tazFlees(wd);
  else if (wd.quest === 4) tazFollows(wd);
  if (wd.talk) return;
  if (dx) wd.face = dx > 0 ? 1 : -1;
  if (dx && !blocked(wd, wd.x + dx * SPEED, wd.y)) wd.x += dx * SPEED;
  if (dy && !blocked(wd, wd.x, wd.y + dy * SPEED)) wd.y += dy * SPEED;
  /* pastelitos (solo cuentan si ya empezó el encargo) */
  for (const c of wd.cakes) {
    if (c.taken || wd.quest !== 1 || Math.hypot(c.x - wd.x, c.y - wd.y) > 11) continue;
    c.taken = true;
    wd.found++;
    wd.events.push("cake");
  }
  /* hablar */
  if (act) {
    const n = nearby(wd);
    if (n) {
      wd.talk = linesFor(wd, n.who);
      wd.page = 0;
      wd.events.push("talk");
    }
  }
}
