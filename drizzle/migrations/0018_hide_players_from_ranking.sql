ALTER TABLE public.players ADD COLUMN hidden_from_ranking boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.global_leaderboard(p_mode text, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, nickname text, score integer, skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_mode NOT IN ('normal','hard','taz') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  RETURN QUERY
    SELECT p.id, p.nickname,
      CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END AS score,
      p.skin
    FROM players p
    WHERE NOT p.hidden_from_ranking
    ORDER BY score DESC, p.created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.friends_leaderboard(p_id uuid, p_secret uuid, p_mode text)
RETURNS TABLE(id uuid, nickname text, score integer, skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_mode NOT IN ('normal','hard','taz') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  RETURN QUERY
    WITH friends AS (
      SELECT f.addressee AS fid FROM friendships f WHERE f.requester = p_id AND f.accepted
      UNION
      SELECT f.requester FROM friendships f WHERE f.addressee = p_id AND f.accepted
      UNION SELECT p_id
    )
    SELECT p.id, p.nickname,
      CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END AS score,
      p.skin
    FROM players p
    JOIN friends fr ON fr.fid = p.id
    WHERE NOT p.hidden_from_ranking
    ORDER BY score DESC, p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_leaderboard(p_day date, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, nickname text, score integer, skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.nickname, d.score, p.skin
    FROM daily_scores d
    JOIN players p ON p.id = d.player_id
    WHERE d.day = p_day AND NOT p.hidden_from_ranking
    ORDER BY d.score DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;