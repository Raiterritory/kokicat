-- Modo "Atrapa al Taz": récord propio y ranking online.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS best_taz int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS players_best_taz ON public.players (best_taz DESC);

-- Guarda el récord de Atrapa al Taz tal como está en el teléfono
CREATE OR REPLACE FUNCTION public.set_taz_score(p_id uuid, p_secret uuid, p_score int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  UPDATE players SET best_taz = LEAST(GREATEST(COALESCE(p_score, 0), 0), 100000), updated_at = now() WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_taz_score(uuid, uuid, int) TO anon, authenticated;

-- Rankings: p_mode puede ser 'normal', 'hard' o 'taz' (misma firma y tipo de retorno que antes)
CREATE OR REPLACE FUNCTION public.global_leaderboard(p_mode text, p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, nickname text, score int, skin text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nickname,
         CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END AS score,
         p.skin
  FROM players p
  WHERE (CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END) > 0
  ORDER BY score DESC, p.updated_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.friends_leaderboard(p_id uuid, p_secret uuid, p_mode text)
RETURNS TABLE(id uuid, nickname text, score int, skin text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  RETURN QUERY
  SELECT p.id, p.nickname,
         CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END,
         p.skin
  FROM players p
  WHERE p.id = p_id OR p.id IN (
    SELECT CASE WHEN f.requester = p_id THEN f.addressee ELSE f.requester END
    FROM friendships f WHERE f.accepted AND (f.requester = p_id OR f.addressee = p_id))
  ORDER BY 3 DESC;
END $$;