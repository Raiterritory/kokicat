export const BOSS_EVERY = 15;
export const BOSS_FRAMES = 720;
export const BOSS_SIZE = 130;
export const BOSS_WARN = 60;
export const BEAM_FRAMES = 20;
export const BEAM_H = 18;

const SHOT_COOLDOWN = 115;
const MIN_TARGET_MARGIN = 48;

export type BossShot = { y: number; t: number };

export type BossState = {
  x: number;
  y: number;
  t: number;
  cd: number;
  shots: BossShot[];
};

export function createBoss(width: number, height: number): BossState {
  return {
    x: width + BOSS_SIZE,
    y: height / 2,
    t: 0,
    shots: [],
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
  },
): { leaving: boolean; finished: boolean } {
  const { width, height, groundHeight, playerY, playerVelocity } = options;
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

  if (!leaving && boss.x < targetX + 20) {
    boss.cd--;
    if (boss.cd <= 0) {
      // Anticipa suavemente el movimiento actual y fija el blanco durante el aviso.
      // El pequeño margen aleatorio evita que todos los disparos sean idénticos.
      const aimOffset = (Math.random() - 0.5) * 34;
      const predictedY = playerY + playerVelocity * 7 + aimOffset;
      const shotY = Math.max(
        MIN_TARGET_MARGIN,
        Math.min(height - groundHeight - MIN_TARGET_MARGIN, predictedY),
      );
      boss.shots.push({ y: shotY, t: 0 });
      boss.cd = SHOT_COOLDOWN;
    }
  }

  for (const shot of boss.shots) shot.t++;
  boss.shots = boss.shots.filter((shot) => shot.t < BOSS_WARN + BEAM_FRAMES);

  return {
    leaving,
    finished: leaving && boss.x > width + BOSS_SIZE,
  };
}