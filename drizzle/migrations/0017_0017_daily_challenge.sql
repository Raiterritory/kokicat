-- "El reto de hoy" (versión 2.9): una partida al día por jugador, con su propio ranking del día.
CREATE TABLE IF NOT EXISTS public.daily_scores (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  day date NOT NULL,
  score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, day)
);
CREATE INDEX IF NOT EXISTS daily_scores_day ON public.daily_scores (day, score DESC);

-- solo se usa a través de las funciones de abajo
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;

-- Guarda el puntaje del día. Cuenta solo el primero (una partida al día); el día es el de Chile
-- y se acepta con un día de margen por la diferencia de horario.
CREATE OR REPLACE FUNCTION public.submit_daily(p_id uuid, p_secret uuid, p_day date, p_score int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_day IS NULL OR abs(p_day - (now() AT TIME ZONE 'America/Santiago')::date) > 1 THEN
    RAISE EXCEPTION 'invalid_day';
  END IF;
  INSERT INTO daily_scores (player_id, day, score)
  VALUES (p_id, p_day, LEAST(GREATEST(COALESCE(p_score, 0), 0), 100000))
  ON CONFLICT (player_id, day) DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_daily(uuid, uuid, date, int) TO anon, authenticated;

-- Ranking de un día: los mejores primero; a igual puntaje, quien jugó antes
CREATE OR REPLACE FUNCTION public.daily_leaderboard(p_day date, p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, nickname text, score int, skin text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nickname, d.score, p.skin
  FROM daily_scores d JOIN players p ON p.id = d.player_id
  WHERE d.day = p_day
  ORDER BY d.score DESC, d.created_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
GRANT EXECUTE ON FUNCTION public.daily_leaderboard(date, int) TO anon, authenticated;
