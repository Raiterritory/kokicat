// Koki Adventure: el barrio de Koki y la plaza vistos desde arriba, la pandilla y los encargos. Sin dibujos:
// solo los mapas, quién está dónde, el movimiento de Koki, con quién se puede hablar y qué dice cada uno.
//
// Los mapas son texto (una letra = un bloque de 16x16), así los pueden leer también las consolas:
//   g pasto   f flores   p camino   w agua   b arbusto (borde)   n reja   T árbol (2x2)   H casa (4x3)   s letrero
//   q baldosas   F pileta (4x4)   B banca   S puesto de la feria (3x2)   e salida a otro mapa
//   K donde parte Koki   G Gufi   R el Ratón   Z el Taz   c un pastelito escondido   P la Tía del pescado   Q el Quiltro
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
  "bppppppppppppppppppppppppppppe",
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

/* la plaza: al otro lado del barrio, por el camino (se abre cuando el Ratón cuenta su secreto) */
export const PLAZA = [
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bgTTggggqqqSSSqqSSSqqgggTTgggb",
  "bgTTgTTgqqqSSSqqSSSqqgggTTgggb",
  "bggggTTgqqqqqqqqqPqqqgggggTTgb",
  "bgggggggqqqqqqqqqqqqqgggggTTgb",
  "bqqqqqqqqqqqqqqqqqqqqqqqqqqqqb",
  "bqqqqqqqqqBBqqqqqqBBqqqqqqqqqb",
  "bqqqqqqqqqqqqqqqqqqqqqqqqqqqqb",
  "bqqqqqqqqqqqqFFFFqqqqqqqqqqqqb",
  "eqqqqqqqqqqqqFFFFqqqqqqqqqqqqb",
  "bqqqqqqqqqqqqFFFFqqqqqqqqqqqqb",
  "bqqqqqqqqqqqqFFFFqqqqqqqqqqqqb",
  "bqqqqqqqqqqqQqqqqqqqqqqqqqqqqb",
  "bqqqqqqqqqBBqqqqqqBBqqqqqqqqqb",
  "bgggggggqqqqqqqqqqqqqggggggggb",
  "bgTTggggqqqqqqqqqqqqqggggTTggb",
  "bgTTggggqqqqqqqqqqqqqggggTTggb",
  "bgggggggqqqSSSqqSSSqqggggggggb",
  "bgggggggqqqSSSqqSSSqqggggggggb",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
];
export const MAPS: Record<string, string[]> = { barrio: BARRIO, plaza: PLAZA };
/* las salidas: de qué mapa a cuál, y dónde aparece Koki */
const EXITS: Record<string, { to: string; tx: number; ty: number; face: -1 | 1 }> = {
  barrio: { to: "plaza", tx: 1, ty: 9, face: 1 },
  plaza: { to: "barrio", tx: 28, ty: 9, face: -1 },
};

export type Who = "gufi" | "raton" | "taz" | "tia" | "quiltro";
export type Npc = { who: Who; map: string; x: number; y: number; hidden?: boolean };
/* una paloma de la feria: picotea quieta o se va volando (fly > 0) */
export type Pigeon = { x: number; y: number; fly: number; dir: -1 | 1 };
export type Cake = { x: number; y: number; taken: boolean };
export type Line = { who: Who | "koki" | "nadie"; text: string };
/*
 * en qué va la historia:
 *   encargo 1, "Los pastelitos de Gufi": 0 sin empezar, 1 buscando, 2 terminado
 *   encargo 2, "Pilla al Taz":           3 persiguiéndolo, 4 te sigue de vuelta donde Gufi, 5 terminado
 *   encargo 3, "Las escondidas":         6 buscando al Ratón (3 veces), 7 terminado (se abre la plaza)
 *   encargo 4, "La feria del domingo":   8 espantando palomas, 9 volver donde la Tía, 10 terminado
 */
export type World = {
  w: number;
  h: number;
  map: string; /* dónde está Koki: "barrio" o "plaza" */
  grounds: Record<string, string[]>;
  ground: string[]; /* el suelo del mapa donde está Koki */
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
  hideSpot: number; /* dónde está escondido el Ratón (índice en SPOTS) */
  hideRound: number; /* cuántas veces lo has encontrado */
  pigeons: Pigeon[];
  scared: number; /* palomas espantadas */
  pigeonWait: number;
  talk: Line[] | null;
  page: number;
  events: string[];
};

const SOLID = new Set(["b", "w", "n", "T", "H", "s", "F", "B", "S"]);
export const PIGEONS_GOAL = 10;
const SPEED = 1.15;
const TAZ_SPEED = 1.0; /* un poco más lento que Koki: se pilla acorralándolo */
const TAZ_SEES = 80; /* desde qué distancia arranca */
const BODY = 10; /* el cuerpo de Koki para chocar (los pies, 10x6 puntos) */

/* los escondites del Ratón (en bloques), con lo que encuentras si no está ahí */
export const SPOTS: { tx: number; ty: number; name: string; empty: string }[] = [
  {
    tx: 2,
    ty: 2,
    name: "detrás de la casa",
    empty: "Detrás de la casa solo hay una pelota desinflada. Es tuya, de cuando eras guagua.",
  },
  {
    tx: 9,
    ty: 3,
    name: "detrás del letrero",
    empty: "Detrás del letrero hay un caracol. Te mira feo.",
  },
  {
    tx: 14,
    ty: 2,
    name: "entre las flores",
    empty: "Entre las flores hay una abeja que no tiene ganas de hablar contigo.",
  },
  {
    tx: 28,
    ty: 5,
    name: "en la punta de la reja",
    empty: "En la punta de la reja hay un calcetín. ¿De quién será? Mejor no saber.",
  },
  {
    tx: 24,
    ty: 14,
    name: "debajo del árbol",
    empty: "Debajo del árbol hay una piña. Bien piña tú, que no lo encontrai.",
  },
  {
    tx: 7,
    ty: 15,
    name: "en los juncos del estanque",
    empty: "En los juncos hay una rana. Croa. Tú maúllas. Quedan a mano.",
  },
];
const spotXY = (i: number) => [SPOTS[i].tx * TILE + TILE / 2, SPOTS[i].ty * TILE + TILE / 2];
/* el escondite que Koki tiene al lado (para revisarlo con A), o -1 */
export function nearSpot(wd: World) {
  if (wd.quest !== 6 || wd.map !== "barrio") return -1;
  let best = -1,
    bd = 22;
  SPOTS.forEach((_, i) => {
    const [x, y] = spotXY(i);
    const d = Math.hypot(x - wd.x, y - wd.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
/* ¿Koki está cerca del escondite de verdad? (las hojas se mueven) */
export function rustle(wd: World) {
  if (wd.quest !== 6 || wd.hideSpot < 0 || wd.map !== "barrio") return null;
  const [x, y] = spotXY(wd.hideSpot);
  return Math.hypot(x - wd.x, y - wd.y) < 56 ? { x, y } : null;
}
/* el Ratón se esconde en otro lugar (nunca dos veces seguidas en el mismo, ni al lado de Koki) */
function hide(wd: World) {
  const r = wd.npcs.find((n) => n.who === "raton")!;
  r.hidden = true;
  let i = wd.hideSpot;
  for (
    let k = 0;
    k < 20 && (i === wd.hideSpot || Math.hypot(spotXY(i)[0] - wd.x, spotXY(i)[1] - wd.y) < 80);
    k++
  )
    i = (Math.imul(wd.frame + k * 977 + wd.hideRound * 131, 2654435761) >>> 0) % SPOTS.length;
  wd.hideSpot = i;
}
/* para dónde queda el escondite, visto desde quien da la pista */
function towards(n: Npc, i: number) {
  const [x, y] = spotXY(i),
    dx = x - n.x,
    dy = y - n.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "pa' la derecha" : "pa' la izquierda";
  return dy > 0 ? "pa' abajo" : "pa' arriba";
}

export function newWorld(): World {
  const h = BARRIO.length,
    w = BARRIO[0].length;
  const wd: World = {
    w,
    h,
    map: "barrio",
    grounds: {},
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
    hideSpot: -1,
    hideRound: 0,
    pigeons: [],
    scared: 0,
    pigeonWait: 0,
    talk: null,
    page: 0,
    events: [],
  };
  const WHO: Record<string, Who> = { G: "gufi", R: "raton", Z: "taz", P: "tia", Q: "quiltro" };
  for (const [name, rows] of Object.entries(MAPS)) {
    const ground: string[] = [];
    for (let ty = 0; ty < h; ty++) {
      let row = "";
      for (let tx = 0; tx < w; tx++) {
        const c = rows[ty][tx];
        const cx = tx * TILE + TILE / 2,
          cy = ty * TILE + TILE / 2;
        const under = name === "plaza" ? "q" : "g";
        if (c === "K") {
          wd.x = cx;
          wd.y = cy;
          row += "p";
        } else if (WHO[c]) {
          wd.npcs.push({ who: WHO[c], map: name, x: cx, y: cy });
          row += under;
        } else if (c === "c") {
          wd.cakes.push({ x: cx, y: cy, taken: false });
          row += under;
        } else row += c;
      }
      ground.push(row);
    }
    wd.grounds[name] = ground;
  }
  wd.ground = wd.grounds.barrio;
  return wd;
}

/* la salida del barrio a la plaza está tapada por un arbusto hasta que el Ratón cuenta su secreto */
export const exitOpen = (wd: World) => wd.map !== "barrio" || wd.quest >= 7;
const solidAt = (wd: World, px: number, py: number) => {
  const tx = Math.floor(px / TILE),
    ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= wd.w || ty >= wd.h) return true;
  const c = wd.ground[ty][tx];
  if (c === "e") return !exitOpen(wd);
  return SOLID.has(c);
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
      n.map === wd.map &&
      !n.hidden &&
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
    if (n.hidden || n.map !== wd.map) continue;
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
    if (wd.quest === 6) {
      const n = wd.npcs.find((p) => p.who === "gufi")!;
      return [
        {
          who: "gufi",
          text: `¿El Ratón? Sentí un ruido ${towards(n, wd.hideSpot)}… o eran mis tripas.`,
        },
      ];
    }
    return [{ who: "gufi", text: "Tamos todos en paz. Por ahora." }];
  }
  if (who === "raton") {
    if (wd.quest === 5) {
      wd.quest = 6;
      wd.hideRound = 0;
      wd.events.push("quest");
      hide(wd);
      return [
        {
          who: "raton",
          text: "Oye, Koki, me aburro. ¿Juguemos a las escondidas? Yo me escondo, tú buscai.",
        },
        {
          who: "raton",
          text: "Tres veces. Si me encontrai las tres, te doy mi mejor secreto. Cuento hasta tres y… ¡chao!",
        },
        { who: "nadie", text: "🐭 El Ratón se esconde. Revisa los rincones del barrio con A." },
      ];
    }
    if (wd.quest === 7)
      return [
        {
          who: "raton",
          text: "La plaza queda al final del camino, pa' la derecha. Ya saqué el arbusto que tapaba la pasada.",
        },
      ];
    if (wd.quest >= 7)
      return [
        { who: "raton", text: "La próxima me escondo en tu plato de comida. Ahí no vai a mirar." },
      ];
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
  if (who === "tia") {
    if (wd.quest < 7)
      return [{ who: "tia", text: "¡Pescado fresco, casero! ¡Reineta, merluza, jurel!" }];
    if (wd.quest === 7) {
      wd.quest = 8;
      wd.scared = 0;
      wd.pigeonWait = 0;
      wd.events.push("quest");
      return [
        { who: "tia", text: "¿Un pescadito, gatito? Son tres lucas, mijo." },
        { who: "koki", text: "Miau. (Koki no tiene bolsillos.)" },
        {
          who: "tia",
          text: `Ya, hagamos un trato: estas palomas me tienen chata, se me suben al puesto. Espántame ${PIGEONS_GOAL} y te regalo una reineta.`,
        },
      ];
    }
    if (wd.quest === 8)
      return [
        { who: "tia", text: `Llevai ${wd.scared} de ${PIGEONS_GOAL}. ¡Ahí viene otra, ataca!` },
      ];
    if (wd.quest === 9) {
      wd.quest = 10;
      wd.justDone = 4;
      wd.events.push("done");
      return [
        {
          who: "tia",
          text: "¡Bien, gatito! Nunca había tenido el puesto tan limpio. Toma tu reineta.",
        },
        { who: "koki", text: "MIAU. (Koki se come la reineta entera. Con espinas y todo.)" },
        { who: "tia", text: "Vuelve el otro domingo, que te tengo un trabajito más." },
      ];
    }
    return [
      {
        who: "tia",
        text: "¿Otra vez por acá? El domingo que viene te guardo una cabeza de pescado.",
      },
    ];
  }
  if (who === "quiltro") {
    if (wd.quest === 8)
      return [
        {
          who: "quiltro",
          text: "Las palomas le tienen miedo a los gatos, no a los quiltros. Injusto.",
        },
      ];
    if (wd.quest >= 10)
      return [
        { who: "quiltro", text: "Oye, ¿y no sobró nada de esa reineta? Una espinita aunque sea." },
      ];
    return [
      { who: "quiltro", text: "¿Voh soy el gato del pasaje? Aquí en la plaza mando yo." },
      { who: "quiltro", text: "Bueno, la Tía manda. Yo dormito." },
    ];
  }
  /* el Taz */
  if (wd.quest === 2) return [{ who: "taz", text: "Miau. (Se hace el leso.)" }];
  if (wd.quest === 3) return [{ who: "taz", text: "¡No me pillai, gil!" }];
  if (wd.quest === 4) return [{ who: "taz", text: "Ya, ya, voy… no me apurí." }];
  if (wd.quest === 6) {
    const t = tazOf(wd);
    return [
      {
        who: "taz",
        text: `Lo vi correr ${towards(t, wd.hideSpot)}. No le digai que te dije, que me debe plata.`,
      },
    ];
  }
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

/* las palomas de la feria: llegan de a una a picotear cerca de los puestos y se van volando si Koki se acerca */
function pigeons(wd: World) {
  for (const p of wd.pigeons) {
    if (p.fly > 0) {
      p.fly++;
      p.y -= 1.4;
      p.x += p.dir * 1.2;
      continue;
    }
    if (wd.frame % 24 === 0)
      p.dir = ((Math.imul(wd.frame + Math.round(p.x), 2654435761) >>> 0) & 1 ? 1 : -1) as -1 | 1;
    if (wd.map === "plaza" && Math.hypot(p.x - wd.x, p.y - wd.y) < 20) {
      p.fly = 1;
      p.dir = p.x > wd.x ? 1 : -1;
      if (wd.quest === 8) {
        wd.scared++;
        wd.events.push("pigeon");
        if (wd.scared >= PIGEONS_GOAL) {
          wd.quest = 9;
          wd.events.push("quest");
        }
      }
    }
  }
  wd.pigeons = wd.pigeons.filter((p) => p.fly < 60);
  /* llega otra (hasta 4 a la vez, mientras falten) */
  const sitting = wd.pigeons.filter((p) => p.fly === 0).length;
  if (
    wd.quest === 8 &&
    sitting < 4 &&
    sitting + wd.scared < PIGEONS_GOAL + 2 &&
    ++wd.pigeonWait > 70
  ) {
    wd.pigeonWait = 0;
    for (let k = 0; k < 12; k++) {
      const r = Math.imul(wd.frame + k * 7919, 2654435761) >>> 0;
      const tx = 8 + (r % 13),
        ty = 3 + ((r >>> 8) % 13);
      if ((wd.grounds.plaza[ty] ?? "")[tx] !== "q") continue;
      const x = tx * TILE + TILE / 2,
        y = ty * TILE + TILE / 2;
      if (wd.map === "plaza" && Math.hypot(x - wd.x, y - wd.y) < 50) continue;
      wd.pigeons.push({ x, y, fly: 0, dir: r & 1 ? 1 : -1 });
      break;
    }
  }
}
/* pisar una salida lleva al otro mapa */
function travel(wd: World) {
  const tx = Math.floor(wd.x / TILE),
    ty = Math.floor(wd.y / TILE);
  if (wd.ground[ty]?.[tx] !== "e" || !exitOpen(wd)) return;
  const ex = EXITS[wd.map];
  wd.map = ex.to;
  wd.ground = wd.grounds[ex.to];
  wd.x = ex.tx * TILE + TILE / 2;
  wd.y = ex.ty * TILE + TILE / 2;
  wd.face = ex.face;
  wd.events.push("map");
}

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
  if (wd.quest === 8 || wd.pigeons.length) pigeons(wd);
  if (wd.talk) return;
  if (dx) wd.face = dx > 0 ? 1 : -1;
  if (dx && !blocked(wd, wd.x + dx * SPEED, wd.y)) wd.x += dx * SPEED;
  if (dy && !blocked(wd, wd.x, wd.y + dy * SPEED)) wd.y += dy * SPEED;
  travel(wd);
  /* pastelitos (solo cuentan si ya empezó el encargo) */
  for (const c of wd.cakes) {
    if (c.taken || wd.quest !== 1 || wd.map !== "barrio" || Math.hypot(c.x - wd.x, c.y - wd.y) > 11)
      continue;
    c.taken = true;
    wd.found++;
    wd.events.push("cake");
  }
  /* hablar (o, jugando a las escondidas, revisar el rincón de al lado) */
  if (act) {
    const n = nearby(wd);
    const spot = nearSpot(wd);
    if (n) {
      wd.talk = linesFor(wd, n.who);
      wd.page = 0;
      wd.events.push("talk");
    } else if (spot >= 0) {
      wd.page = 0;
      if (spot !== wd.hideSpot) wd.talk = [{ who: "nadie", text: SPOTS[spot].empty }];
      else {
        wd.hideRound++;
        wd.events.push("found");
        if (wd.hideRound < 3) {
          wd.talk = [
            {
              who: "raton",
              text:
                wd.hideRound === 1
                  ? "¡Chuta! Me pillaste. Pero fue suerte. Otra vez."
                  : "¡Ya, ya! Última. Esta vez no me encontrai ni con GPS.",
            },
          ];
          hide(wd);
        } else {
          const r = wd.npcs.find((p) => p.who === "raton")!;
          r.hidden = false;
          wd.quest = 7;
          wd.justDone = 3;
          wd.events.push("done");
          wd.talk = [
            {
              who: "raton",
              text: "¡Ya po! Tres de tres. Teni olfato de perro, y eso que eres gato.",
            },
            {
              who: "raton",
              text: "Mi mejor secreto: al otro lado del barrio hay una plaza… y en la plaza hay feria los domingos. 👀",
            },
            { who: "koki", text: "Miau. (Koki anota mentalmente: feria. Pescado. Domingo.)" },
          ];
        }
      }
    }
  }
}
