// Switching between the Koki and "Atrapa al Taz" modes with the finger: while the finger
// is held and dragged, `progress` (0 = Koki, 1 = Taz) follows it continuously, so one
// screen fades into the other. On release it settles to the nearer side.
import { useCallback, useEffect, useRef } from "react";

const SETTLE_MS = 220;

export function useModeSwipe(progress: number, setProgress: (p: number) => void) {
  const pRef = useRef(progress);
  pRef.current = progress;
  const drag = useRef<{ x: number; p0: number; moved: boolean } | null>(null);
  const anim = useRef<number | null>(null);
  const lastWasDrag = useRef(false);

  const finish = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAnim = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
    if (finish.current != null) clearTimeout(finish.current);
    finish.current = null;
  };

  /** Animates to 0 or 1 (used on release and by the "← KokiCat" button). */
  const animateTo = useCallback((target: number) => {
    stopAnim();
    const from = pRef.current;
    if (from === target) return;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / SETTLE_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      setProgress(from + (target - from) * eased);
      anim.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
    // por si el navegador frena la animación (pestaña en segundo plano): siempre termina en su lugar
    finish.current = setTimeout(() => { stopAnim(); setProgress(target); }, SETTLE_MS + 80);
  }, [setProgress]);

  useEffect(() => stopAnim, []);

  /** Handlers for the element that is dragged (each mode's logo). */
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      stopAnim();
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      drag.current = { x: e.clientX, p0: pRef.current, moved: false };
      lastWasDrag.current = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 6) d.moved = true;
      if (!d.moved) return;
      // recorrer ~70% del ancho de la pantalla hace el cambio completo
      const span = Math.max(220, window.innerWidth * 0.7);
      setProgress(Math.min(1, Math.max(0, d.p0 + dx / span)));
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      e.stopPropagation();
      lastWasDrag.current = d.moved;
      if (d.moved) animateTo(pRef.current > 0.5 ? 1 : 0);
    },
    onPointerCancel: () => {
      if (!drag.current) return;
      drag.current = null;
      animateTo(pRef.current > 0.5 ? 1 : 0);
    },
  };

  /** True right after a drag, so the logo's tap action (its sound) can be skipped. */
  const wasDrag = () => lastWasDrag.current;

  return { handlers, animateTo, wasDrag };
}
