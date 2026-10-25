CREATE TABLE public.player_web_effect_days (
 player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
 day date NOT NULL,
 blocked_windows jsonb NOT NULL,
 PRIMARY KEY (player_id, day)
);
GRANT ALL ON public.player_web_effect_days TO service_role;
ALTER TABLE public.player_web_effect_days ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.player_web_effects(p_id uuid, p_secret uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 nick text;
 local_now timestamp := clock_timestamp() AT TIME ZONE 'America/Santiago';
 windows jsonb;
 minute_now numeric;
 blocked boolean;
BEGIN
 PERFORM public._auth_player(p_id, p_secret);
 SELECT nickname INTO nick FROM public.players WHERE id = p_id;
 IF lower(nick) <> 'namu' OR local_now::date < DATE '2026-10-25' THEN
  RETURN jsonb_build_object('target', false, 'blocked', false);
 END IF;
 INSERT INTO public.player_web_effect_days(player_id, day, blocked_windows)
 SELECT p_id, local_now::date, jsonb_agg(jsonb_build_object('start', start_min, 'end', start_min + duration))
 FROM (SELECT n * 240 + floor(random() * 180)::integer AS start_min,
              10 + floor(random() * 31)::integer AS duration
       FROM generate_series(0, 5) AS n) AS periods
 ON CONFLICT (player_id, day) DO NOTHING;
 SELECT blocked_windows INTO windows FROM public.player_web_effect_days
 WHERE player_id = p_id AND day = local_now::date;
 minute_now := extract(epoch FROM local_now::time) / 60;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(windows) w
 WHERE minute_now >= (w->>'start')::numeric AND minute_now < (w->>'end')::numeric) INTO blocked;
 RETURN jsonb_build_object('target', true, 'blocked', blocked,
 'coins', floor(random()*10000)::integer, 'best', floor(random()*1000)::integer);
END;
$$;
REVOKE ALL ON FUNCTION public.player_web_effects(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_web_effects(uuid,uuid) TO anon, authenticated;
COMMENT ON TABLE public.player_web_effect_days IS 'Persisted random daily display-only web blackout schedule; actual saves are never modified.';