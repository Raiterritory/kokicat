import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPlayer } from '@/lib/leaderboard';
import { isNativeApp, webIsOpen } from '@/lib/web-hours';
import { stopMusic } from '@/lib/sounds';
import { webAccess, type WebEffects } from '@/lib/web-effects';

const NONE: WebEffects = { target: false, blocked: false };

export function WebGate({ children }: { children: (effects: WebEffects) => ReactNode }) {
  const [effects, setEffects] = useState<WebEffects>(NONE);
  const [access, setAccess] = useState({ open: true, black: false });
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let latest = NONE;
    const apply = () => {
      if (!disposed) setAccess(webAccess(isNativeApp(), webIsOpen(), latest));
    };
    const refresh = async () => {
      const request = ++generation;
      if (isNativeApp()) { latest = NONE; setEffects(NONE); apply(); return; }
      const player = getPlayer();
      if (!player) { latest = NONE; setEffects(NONE); apply(); return; }
      try {
        const { data, error } = await supabase.rpc('player_web_effects', { p_id: player.id, p_secret: player.secret });
        if (disposed || request !== generation) return;
        latest = !error && data && typeof data === 'object' && !Array.isArray(data)
          ? data as WebEffects : NONE;
        setEffects(latest);
      } catch {
        if (disposed || request !== generation) return;
        latest = NONE; setEffects(NONE);
      }
      apply();
    };
    apply();
    void refresh();
    const identity = () => { latest = NONE; setEffects(NONE); apply(); void refresh(); };
    const tick = setInterval(() => { apply(); void refresh(); }, 15000);
    window.addEventListener('koki-player', identity);
    window.addEventListener('storage', identity);
    window.addEventListener('focus', identity);
    return () => {
      disposed = true; ++generation; clearInterval(tick);
      window.removeEventListener('koki-player', identity);
      window.removeEventListener('storage', identity);
      window.removeEventListener('focus', identity);
    };
  }, []);
  useEffect(() => { if (!access.open) stopMusic(); }, [access.open]);
  if (!access.open) return <div className={access.black ? 'web-blackout' : 'web-hours-closed'} />;
  return children(effects);
}