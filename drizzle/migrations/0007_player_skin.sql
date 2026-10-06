-- Skin que usa cada jugador, para mostrarla junto a su nombre en el ranking.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS skin text NOT NULL DEFAULT 'koki';

CREATE OR REPLACE FUNCTION public.set_skin(p_id uuid, p_secret uuid, p_skin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_skin IS NULL OR p_skin !~ '^[a-z0-9-]{1,32}$' THEN RETURN; END IF;
  UPDATE players SET skin = p_skin WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_skin(uuid, uuid, text) TO anon, authenticated;

-- Los rankings ahora también devuelven la skin (cambia el tipo de retorno: hay que recrearlas)
DROP FUNCTION IF EXISTS public.global_leaderboard(text, int);
CREATE FUNCTION public.global_leaderboard(p_mode text, p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, nickname text, score int, skin text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nickname, CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END AS score, p.skin
  FROM players p
  WHERE (CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END) > 0
  ORDER BY score DESC, p.updated_at ASC
  LIMIT LEAST(GREATEST(p_limit,1),100);
$$;
GRANT EXECUTE ON FUNCTION public.global_leaderboard(text, int) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.friends_leaderboard(uuid, uuid, text);
CREATE FUNCTION public.friends_leaderboard(p_id uuid, p_secret uuid, p_mode text)
RETURNS TABLE(id uuid, nickname text, score int, skin text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  RETURN QUERY
  SELECT p.id, p.nickname, CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END, p.skin
  FROM players p
  WHERE p.id = p_id OR p.id IN (
    SELECT CASE WHEN f.requester = p_id THEN f.addressee ELSE f.requester END
    FROM friendships f WHERE f.accepted AND (f.requester = p_id OR f.addressee = p_id))
  ORDER BY 3 DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.friends_leaderboard(uuid, uuid, text) TO anon, authenticated;
