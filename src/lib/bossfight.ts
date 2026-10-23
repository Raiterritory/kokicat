export const BOSS_EVERY = 15;
export const BOSS_FRAMES = 720;
export const BOSS_SIZE = 130;
export const BOSS_WARN = 60;
export const BEAM_FRAMES = 20;
export const BEAM_H = 18;

const SHOT_COOLDOWN = 115;
const MIN_TARGET_MARGIN = 48;

/**
 * Qué ataca el jefe:
 * - "rayo": el de siempre, un rayo a tu altura (avisa con una línea punteada).
 * - "tubos": lanza tubos que vuelan hacia ti (avisa con una flecha en el borde).
 * - "muro": empuja muros que tapan todo menos un hueco (avisa dónde estará el hueco).
 * - "bombas": lanza bombas dirigidas a donde estás (avisa con una línea y un blanco).
 * En las partidas en vivo solo sale el rayo (igual que en la PS4).
 */
export type BossKind = "rayo" | "tubos" | "muro" | "bombas";
export const BOSS_KINDS: BossKind[] = ["rayo", "tubos", "muro", "bombas"];

/** pista corta que se muestra bajo la barra del jefe */
export const BOSS_HINTS: Record<BossKind, string> = {
  rayo: "¡Esquiva el rayo!",
  tubos: "¡Esquiva los tubos!",
  muro: "¡Busca el hueco!",
  bombas: "¡Esquiva las bombas!",
};

export type BossShot = { y: number; t: number };
/** tubo lanzado: avisa TUBE_WARN cuadros y luego vuela a la izquierda */
export type BossTube = { x: number; y: number; t: number };
/** muro con un hueco: avisa WALL_WARN cuadros y luego avanza */
export type BossWall = { x: number; gapY: number; t: number };
/** bomba dirigida: avisa BOMB_WARN cuadros y luego vuela hasta (tx, ty) */
export type BossBomb = {
  x0: number;
  y0: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
};

export const TUBE_W = 96;
export const TUBE_H = 30;
const TUBE_WARN = 45;
const TUBE_SPEED = 7;
const TUBE_COOLDOWN = 70;
export const WALL_W = 44;
export const WALL_GAP = 175;
const WALL_WARN = 55;
const WALL_SPEED = 4.2;
const WALL_COOLDOWN = 140;

const BOMB_WARN = 55;
const BOMB_FLY = 42;
const BOMB_BLAST = 16;
const BOMB_COOLDOWN = 100;
export const BOMB_R = 13;

export type BossState = {
  kind: BossKind;
  x: number;
  y: number;
  t: number;
  cd: number;
  shots: BossShot[];
  tubes: BossTube[];
  walls: BossWall[];
  bombs: BossBomb[];
};

export function createBoss(width: number, height: number, kind: BossKind = "rayo"): BossState {
  return {
    kind,
    x: width + BOSS_SIZE,
    y: height / 2,
    t: 0,
    shots: [],
    tubes: [],
    walls: [],
    bombs: [],
    cd: 90,
  };
}

export function updateBoss(
  boss: BossState,
  options: {
    width: number;
    height: number;
    groundHeight: number;
    playerX: number;
    playerY: number;
    playerVelocity: number;
    /** cámara lenta: lo que lanza el jefe también va más lento (1 = normal) */
    timeScale?: number;
    /** azar: en el reto diario se pasa el mismo generador con semilla para todos */
    rnd?: () => number;
  },
): { leaving: boolean; finished: boolean } {
  const { width, height, groundHeight, playerX, playerY, playerVelocity } = options;
  const ts = options.timeScale ?? 1;
  const rnd = options.rnd ?? Math.random;
  boss.t++;

  const targetX = width - BOSS_SIZE * 0.6;
  const leaving = boss.t > BOSS_FRAMES;
  boss.x += leaving ? 4 : (targetX - boss.x) * 0.05;

  // El jefe sigue a Koki con retraso y un pequeño vaivén: se siente vivo,
  // pero nunca puede pegarse instantáneamente a cada salto.
  const minY = BOSS_SIZE * 0.55;
  const maxY = height - groundHeight - BOSS_SIZE * 0.55;
  const followY = playerY + Math.sin(boss.t * 0.025) * 34;
  const clampedFollowY = Math.max(minY, Math.min(maxY, followY));
  boss.y += (clampedFollowY - boss.y) * 0.018;
  const floor = height - groundHeight;

  if (!leaving && boss.x < targetX + 20) {
    boss.cd--;
    if (boss.cd <= 0) {
      // Anticipa suavemente el movimiento actual y fija el blanco durante el aviso.
      // El pequeño margen aleatorio evita que todos los disparos sean idénticos.
      const aimOffset = (rnd() - 0.5) * 34;
      const predictedY = playerY + playerVelocity * 7 + aimOffset;
      const aimY = Math.max(MIN_TARGET_MARGIN, Math.min(floor - MIN_TARGET_MARGIN, predictedY));
      if (boss.kind === "rayo") {
        boss.shots.push({ y: aimY, t: 0 });
        boss.cd = SHOT_COOLDOWN;
      } else if (boss.kind === "tubos") {
        boss.tubes.push({ x: boss.x - BOSS_SIZE * 0.4, y: aimY, t: 0 });
        boss.cd = TUBE_COOLDOWN;
      } else if (boss.kind === "bombas") {
        // la bomba apunta a donde estás ahora: hay que moverse durante el aviso
        const x0 = boss.x - BOSS_SIZE * 0.4;
        const y0 = boss.y;
        const tx = Math.max(28, Math.min(width - 28, playerX + (rnd() - 0.5) * 18));
        boss.bombs.push({ x0, y0, x: x0, y: y0, tx, ty: aimY, t: 0 });
        boss.cd = BOMB_COOLDOWN;
      } else {
        // el hueco no salta muy lejos del anterior: siempre se puede alcanzar
        const prev = boss.walls.length ? boss.walls[boss.walls.length - 1].gapY : playerY;
        const lo = WALL_GAP / 2 + 30,
          hi = floor - WALL_GAP / 2 - 30;
        const gapY = Math.max(lo, Math.min(hi, prev + (rnd() - 0.5) * 260));
        boss.walls.push({ x: boss.x - BOSS_SIZE * 0.4, gapY, t: 0 });
        boss.cd = WALL_COOLDOWN;
      }
    }
  }

  for (const shot of boss.shots) shot.t++;
  boss.shots = boss.shots.filter((shot) => shot.t < BOSS_WARN + BEAM_FRAMES);
  for (const tube of boss.tubes) {
    tube.t++;
    if (tube.t > TUBE_WARN) tube.x -= TUBE_SPEED * ts;
  }
  boss.tubes = boss.tubes.filter((tube) => tube.x + TUBE_W > 0);
  for (const wall of boss.walls) {
    wall.t++;
    if (wall.t > WALL_WARN) wall.x -= WALL_SPEED * ts;
  }
  boss.walls = boss.walls.filter((wall) => wall.x + WALL_W > 0);
  for (const bomb of boss.bombs) {
    bomb.t++;
    if (bomb.t > BOMB_WARN) {
      // vuela en diagonal con un arco: se puede esquivar moviéndose a tiempo
      const p = Math.min(1, (bomb.t - BOMB_WARN) / BOMB_FLY);
      bomb.x = bomb.x0 + (bomb.tx - bomb.x0) * p;
      bomb.y = bomb.y0 + (bomb.ty - bomb.y0) * p - Math.sin(p * Math.PI) * 55;
    }
  }
  boss.bombs = boss.bombs.filter((bomb) => bomb.t < BOMB_WARN + BOMB_FLY + BOMB_BLAST);

  return {
    leaving,
    // se va cuando salió de la pantalla y ya no queda nada de lo que lanzó
    finished:
      leaving &&
      boss.x > width + BOSS_SIZE &&
      !boss.tubes.length &&
      !boss.walls.length &&
      !boss.bombs.length,
  };
}

/** ¿Lo que lanzó el jefe le pega a Koki (en x, y, con radio r)? */
export function bossHits(boss: BossState, x: number, y: number, r: number): boolean {
  for (const s of boss.shots) {
    if (s.t >= BOSS_WARN && s.t < BOSS_WARN + BEAM_FRAMES && Math.abs(y - s.y) < BEAM_H / 2 + r - 4)
      return true;
  }
  for (const t of boss.tubes) {
    if (t.t <= TUBE_WARN) continue;
    const cx = Math.max(t.x, Math.min(x, t.x + TUBE_W)),
      cy = Math.max(t.y - TUBE_H / 2, Math.min(y, t.y + TUBE_H / 2));
    if ((x - cx) ** 2 + (y - cy) ** 2 < (r - 3) ** 2) return true;
  }
  for (const w of boss.walls) {
    if (w.t <= WALL_WARN) continue;
    if (
      x + r > w.x &&
      x - r < w.x + WALL_W &&
      (y - r < w.gapY - WALL_GAP / 2 || y + r > w.gapY + WALL_GAP / 2)
    )
      return true;
  }
  for (const b of boss.bombs) {
    if (b.t <= BOMB_WARN || b.t >= BOMB_WARN + BOMB_FLY) continue;
    if ((x - b.x) ** 2 + (y - b.y) ** 2 < (r + BOMB_R) ** 2) return true;
  }
  return false;
}

/** Los ataques del jefe (avisos, rayos, tubos y muros), detrás de su cara. */
export function drawBossAttacks(
  ctx: CanvasRenderingContext2D,
  boss: BossState,
  kokiX: number,
  floorY: number,
  width: number,
  frame: number,
) {
  for (const s of boss.shots) {
    if (s.t < BOSS_WARN) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.45 * (s.t / BOSS_WARN);
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(boss.x, s.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(kokiX, s.y, 13 + Math.sin(s.t * 0.35) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      const lg = ctx.createLinearGradient(0, s.y - BEAM_H / 2, 0, s.y + BEAM_H / 2);
      lg.addColorStop(0, "rgba(255,60,200,0)");
      lg.addColorStop(0.3, "#ff3bd0");
      lg.addColorStop(0.5, "#ffffff");
      lg.addColorStop(0.7, "#3bd8ff");
      lg.addColorStop(1, "rgba(60,200,255,0)");
      ctx.fillStyle = lg;
      ctx.shadowColor = "#ff3bd0";
      ctx.shadowBlur = 20;
      ctx.fillRect(0, s.y - BEAM_H / 2 + Math.sin(frame) * 2, boss.x, BEAM_H);
      ctx.restore();
    }
  }
  for (const t of boss.tubes) {
    ctx.save();
    if (t.t <= TUBE_WARN) {
      // aviso: una flecha roja en el borde, a la altura por donde vendrá el tubo
      ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(t.t * 0.25));
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.moveTo(width - 70, t.y);
      ctx.lineTo(width - 40, t.y - 16);
      ctx.lineTo(width - 40, t.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(kokiX + 40, t.y);
      ctx.lineTo(width - 80, t.y);
      ctx.stroke();
    } else {
      // un tubo de verdad, acostado y girando un poco
      ctx.translate(t.x + TUBE_W / 2, t.y);
      ctx.rotate(Math.sin((frame + t.x) * 0.1) * 0.12);
      const g = ctx.createLinearGradient(0, -TUBE_H / 2, 0, TUBE_H / 2);
      g.addColorStop(0, "#8b95ad");
      g.addColorStop(0.5, "#5a6478");
      g.addColorStop(1, "#3d4658");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#1f2635";
      ctx.lineWidth = 3;
      ctx.fillRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W - 18, TUBE_H);
      ctx.strokeRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W - 18, TUBE_H);
      ctx.fillRect(TUBE_W / 2 - 22, -TUBE_H / 2 - 5, 22, TUBE_H + 10);
      ctx.strokeRect(TUBE_W / 2 - 22, -TUBE_H / 2 - 5, 22, TUBE_H + 10);
    }
    ctx.restore();
  }
  for (const w of boss.walls) {
    ctx.save();
    const top = w.gapY - WALL_GAP / 2,
      bottom = w.gapY + WALL_GAP / 2;
    if (w.t <= WALL_WARN) {
      // aviso: el hueco por donde habrá que pasar, marcado en verde
      ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(w.t * 0.2));
      ctx.strokeStyle = "#3ddc4a";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(width - 120, top, 70, WALL_GAP);
      ctx.fillStyle = "rgba(61,220,74,0.15)";
      ctx.fillRect(width - 120, top, 70, WALL_GAP);
    } else {
      const g = ctx.createLinearGradient(w.x, 0, w.x + WALL_W, 0);
      g.addColorStop(0, "#7a2b2b");
      g.addColorStop(0.5, "#c0473f");
      g.addColorStop(1, "#5a1f1f");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#2a0d0d";
      ctx.lineWidth = 3;
      ctx.fillRect(w.x, 0, WALL_W, top);
      ctx.strokeRect(w.x, -3, WALL_W, top + 3);
      ctx.fillRect(w.x, bottom, WALL_W, floorY - bottom);
      ctx.strokeRect(w.x, bottom, WALL_W, floorY - bottom);
      // ladrillos
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;
      for (let y = 18; y < floorY; y += 18) {
        if (y > top && y < bottom) continue;
        ctx.beginPath();
        ctx.moveTo(w.x, y);
        ctx.lineTo(w.x + WALL_W, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  for (const b of boss.bombs) {
    ctx.save();
    if (b.t <= BOMB_WARN) {
      // aviso: línea desde el jefe hasta el blanco y una mira que late
      ctx.globalAlpha = 0.35 + 0.45 * (b.t / BOMB_WARN);
      ctx.strokeStyle = "#ff8a3b";
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.tx, b.ty);
      ctx.stroke();
      ctx.setLineDash([]);
      const pulse = 1 + Math.sin(b.t * 0.3) * 0.12;
      ctx.beginPath();
      ctx.arc(b.tx, b.ty, (18 + (b.t / BOMB_WARN) * 8) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.tx - 12, b.ty);
      ctx.lineTo(b.tx + 12, b.ty);
      ctx.moveTo(b.tx, b.ty - 12);
      ctx.lineTo(b.tx, b.ty + 12);
      ctx.stroke();
    } else if (b.t < BOMB_WARN + BOMB_FLY) {
      // bomba en vuelo, con estela de fuego
      const ang = Math.atan2(b.ty - b.y0, b.tx - b.x0);
      for (let i = 1; i <= 6; i++) {
        const px = b.x - Math.cos(ang) * i * 8;
        const py = b.y - Math.sin(ang) * i * 8;
        ctx.globalAlpha = (1 - i / 7) * 0.5;
        ctx.fillStyle = i < 3 ? "#ffd23f" : "#ff6b1a";
        ctx.beginPath();
        ctx.arc(px, py, 8 - i * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const body = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, BOMB_R);
      body.addColorStop(0, "#6b7280");
      body.addColorStop(1, "#111827");
      ctx.fillStyle = body;
      ctx.strokeStyle = "#0b1020";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BOMB_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // mecha encendida
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 5, b.y - BOMB_R + 2);
      ctx.quadraticCurveTo(b.x + 11, b.y - BOMB_R - 6, b.x + 7, b.y - BOMB_R - 12);
      ctx.stroke();
      ctx.fillStyle = Math.floor(b.t / 3) % 2 ? "#fff3a0" : "#ff9d2e";
      ctx.beginPath();
      ctx.arc(b.x + 7, b.y - BOMB_R - 13, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // explosión al llegar al blanco
      const left = Math.max(0, 1 - (b.t - BOMB_WARN - BOMB_FLY) / BOMB_BLAST);
      const rr = 10 + (1 - left) * 34;
      const blast = ctx.createRadialGradient(b.tx, b.ty, 2, b.tx, b.ty, rr);
      blast.addColorStop(0, `rgba(255,255,220,${left})`);
      blast.addColorStop(0.5, `rgba(255,150,40,${left * 0.8})`);
      blast.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = blast;
      ctx.beginPath();
      ctx.arc(b.tx, b.ty, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
