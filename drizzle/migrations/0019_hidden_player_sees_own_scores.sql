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
    WHERE NOT p.hidden_from_ranking OR p.id = p_id
    ORDER BY score DESC, p.created_at ASC;
END;
$$;