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
/* el encargo: 0 sin empezar, 1 buscando, 2 terminado */
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
  quest: 0 | 1 | 2;
  found: number;
  tazGave: boolean;
  tazAsked: number;
  talk: Line[] | null;
  page: number;
  events: string[];
};

const SOLID = new Set(["b", "w", "n", "T", "H", "s"]);
const SPEED = 1.15;
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
    found: 0,
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
/* ¿los pies de Koki en (x, y) chocan con algo? (bloques sólidos o alguien de la pandilla) */
function blocked(wd: World, x: number, y: number) {
  const x0 = x - BODY / 2,
    x1 = x + BODY / 2,
    y0 = y + 1,
    y1 = y + 7;
  if (solidAt(wd, x0, y0) || solidAt(wd, x1, y0) || solidAt(wd, x0, y1) || solidAt(wd, x1, y1))
    return true;
  return wd.npcs.some((n) => Math.abs(n.x - x) < 12 && Math.abs(n.y - y) < 9);
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
      wd.events.push("done");
      return [
        { who: "gufi", text: "¡Bacán, Koki! Ahora sí hay once." },
        { who: "gufi", text: "…¿Y por qué este está mordido? 🤨" },
        { who: "taz", text: "(Desde la reja) Miau. Yo no fui." },
      ];
    }
    return [{ who: "gufi", text: "Tamos listos pa' la once. Gracias, compadre." }];
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
    return [{ who: "raton", text: "Me guardaron un pedacito, ¿cierto? ¿Cierto?" }];
  }
  /* el Taz */
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
