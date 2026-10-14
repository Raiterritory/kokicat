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
 * En las partidas en vivo solo sale el rayo (igual que en la PS4).
 */
export type BossKind = "rayo" | "tubos" | "muro";
export const BOSS_KINDS: BossKind[] = ["rayo", "tubos", "muro"];

export type BossShot = { y: number; t: number };
/** tubo lanzado: avisa TUBE_WARN cuadros y luego vuela a la izquierda */
export type BossTube = { x: number; y: number; t: number };
/** muro con un hueco: avisa WALL_WARN cuadros y luego avanza */
export type BossWall = { x: number; gapY: number; t: number };

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

export type BossState = {
  kind: BossKind;
  x: number;
  y: number;
  t: number;
  cd: number;
  shots: BossShot[];
  tubes: BossTube[];
  walls: BossWall[];
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
    cd: 90,
  };
}

export function updateBoss(
  boss: BossState,
  options: {
    width: number;
    height: number;
    groundHeight: number;
    playerY: number;
    playerVelocity: number;
    /** cámara lenta: lo que lanza el jefe también va más lento (1 = normal) */
    timeScale?: number;
  },
): { leaving: boolean; finished: boolean } {
  const { width, height, groundHeight, playerY, playerVelocity } = options;
  const ts = options.timeScale ?? 1;
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
      const aimOffset = (Math.random() - 0.5) * 34;
      const predictedY = playerY + playerVelocity * 7 + aimOffset;
      const aimY = Math.max(MIN_TARGET_MARGIN, Math.min(floor - MIN_TARGET_MARGIN, predictedY));
      if (boss.kind === "rayo") {
        boss.shots.push({ y: aimY, t: 0 });
        boss.cd = SHOT_COOLDOWN;
      } else if (boss.kind === "tubos") {
        boss.tubes.push({ x: boss.x - BOSS_SIZE * 0.4, y: aimY, t: 0 });
        boss.cd = TUBE_COOLDOWN;
      } else {
        // el hueco no salta muy lejos del anterior: siempre se puede alcanzar
        const prev = boss.walls.length ? boss.walls[boss.walls.length - 1].gapY : playerY;
        const lo = WALL_GAP / 2 + 30, hi = floor - WALL_GAP / 2 - 30;
        const gapY = Math.max(lo, Math.min(hi, prev + (Math.random() - 0.5) * 260));
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

  return {
    leaving,
    // se va cuando salió de la pantalla y ya no queda nada de lo que lanzó
    finished: leaving && boss.x > width + BOSS_SIZE && !boss.tubes.length && !boss.walls.length,
  };
}

/** ¿Lo que lanzó el jefe le pega a Koki (en x, y, con radio r)? */
export function bossHits(boss: BossState, x: number, y: number, r: number): boolean {
  for (const s of boss.shots) {
    if (s.t >= BOSS_WARN && s.t < BOSS_WARN + BEAM_FRAMES && Math.abs(y - s.y) < BEAM_H / 2 + r - 4) return true;
  }
  for (const t of boss.tubes) {
    if (t.t <= TUBE_WARN) continue;
    const cx = Math.max(t.x, Math.min(x, t.x + TUBE_W)), cy = Math.max(t.y - TUBE_H / 2, Math.min(y, t.y + TUBE_H / 2));
    if ((x - cx) ** 2 + (y - cy) ** 2 < (r - 3) ** 2) return true;
  }
  for (const w of boss.walls) {
    if (w.t <= WALL_WARN) continue;
    if (x + r > w.x && x - r < w.x + WALL_W && (y - r < w.gapY - WALL_GAP / 2 || y + r > w.gapY + WALL_GAP / 2)) return true;
  }
  return false;
}

/** Los ataques del jefe (avisos, rayos, tubos y muros), detrás de su cara. */
export function drawBossAttacks(ctx: CanvasRenderingContext2D, boss: BossState, kokiX: number, floorY: number, width: number, frame: number) {
  for (const s of boss.shots) {
    if (s.t < BOSS_WARN) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.45 * (s.t / BOSS_WARN);
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(boss.x, s.y); ctx.stroke();
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
      ctx.shadowColor = "#ff3bd0"; ctx.shadowBlur = 20;
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
      ctx.beginPath(); ctx.moveTo(kokiX + 40, t.y); ctx.lineTo(width - 80, t.y); ctx.stroke();
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
    const top = w.gapY - WALL_GAP / 2, bottom = w.gapY + WALL_GAP / 2;
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
        ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + WALL_W, y); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
