CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  secret uuid NOT NULL DEFAULT gen_random_uuid(),
  best_normal int NOT NULL DEFAULT 0,
  best_hard int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX players_nick_lower ON public.players (lower(nickname));
CREATE INDEX players_best_normal ON public.players (best_normal DESC);
CREATE INDEX players_best_hard ON public.players (best_hard DESC);

CREATE TABLE public.friendships (
  requester uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  addressee uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester, addressee),
  CHECK (requester <> addressee)
);

GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
-- No direct client access: everything goes through the functions below.

CREATE OR REPLACE FUNCTION public._auth_player(p_id uuid, p_secret uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_id AND secret = p_secret) THEN
    RAISE EXCEPTION 'invalid_player';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._auth_player(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_player(p_nick text)
RETURNS TABLE(id uuid, secret uuid, nickname text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text := btrim(p_nick);
BEGIN
  IF n !~ '^[A-Za-z0-9_ áéíóúñÁÉÍÓÚÑ]{3,16}$' THEN RAISE EXCEPTION 'invalid_nick'; END IF;
  IF EXISTS (SELECT 1 FROM players p WHERE lower(p.nickname) = lower(n)) THEN RAISE EXCEPTION 'nick_taken'; END IF;
  RETURN QUERY INSERT INTO players(nickname) VALUES (n) RETURNING players.id, players.secret, players.nickname;
END $$;

CREATE OR REPLACE FUNCTION public.submit_score(p_id uuid, p_secret uuid, p_normal int, p_hard int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  UPDATE players SET
    best_normal = GREATEST(best_normal, LEAST(GREATEST(COALESCE(p_normal,0),0), 100000)),
    best_hard = GREATEST(best_hard, LEAST(GREATEST(COALESCE(p_hard,0),0), 100000)),
    updated_at = now()
  WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.global_leaderboard(p_mode text, p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, nickname text, score int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nickname, CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END AS score
  FROM players p
  WHERE (CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END) > 0
  ORDER BY score DESC, p.updated_at ASC
  LIMIT LEAST(GREATEST(p_limit,1),100);
$$;

CREATE OR REPLACE FUNCTION public.friends_leaderboard(p_id uuid, p_secret uuid, p_mode text)
RETURNS TABLE(id uuid, nickname text, score int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  RETURN QUERY
  SELECT p.id, p.nickname, CASE WHEN p_mode = 'hard' THEN p.best_hard ELSE p.best_normal END
  FROM players p
  WHERE p.id = p_id OR p.id IN (
    SELECT CASE WHEN f.requester = p_id THEN f.addressee ELSE f.requester END
    FROM friendships f WHERE f.accepted AND (f.requester = p_id OR f.addressee = p_id))
  ORDER BY 3 DESC;
END $$;

CREATE OR REPLACE FUNCTION public.search_players(p_id uuid, p_secret uuid, p_query text)
RETURNS TABLE(id uuid, nickname text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF length(btrim(p_query)) < 2 THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.nickname FROM players p
  WHERE p.id <> p_id AND p.nickname ILIKE '%' || replace(replace(btrim(p_query),'%',''),'_','\_') || '%'
  ORDER BY length(p.nickname) LIMIT 15;
END $$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_id uuid, p_secret uuid, p_to uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_to = p_id THEN RETURN; END IF;
  -- If they already asked me, accept
  IF EXISTS (SELECT 1 FROM friendships WHERE requester = p_to AND addressee = p_id) THEN
    UPDATE friendships SET accepted = true WHERE requester = p_to AND addressee = p_id;
    RETURN;
  END IF;
  INSERT INTO friendships(requester, addressee) VALUES (p_id, p_to) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_id uuid, p_secret uuid, p_from uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_accept THEN
    UPDATE friendships SET accepted = true WHERE requester = p_from AND addressee = p_id;
  ELSE
    DELETE FROM friendships WHERE requester = p_from AND addressee = p_id AND NOT accepted;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_id uuid, p_secret uuid, p_other uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  DELETE FROM friendships WHERE (requester = p_id AND addressee = p_other) OR (requester = p_other AND addressee = p_id);
END $$;

CREATE OR REPLACE FUNCTION public.my_friends(p_id uuid, p_secret uuid)
RETURNS TABLE(id uuid, nickname text, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  RETURN QUERY
  SELECT p.id, p.nickname,
    CASE WHEN f.accepted THEN 'friend' WHEN f.requester = p_id THEN 'sent' ELSE 'incoming' END
  FROM friendships f
  JOIN players p ON p.id = CASE WHEN f.requester = p_id THEN f.addressee ELSE f.requester END
  WHERE f.requester = p_id OR f.addressee = p_id
  ORDER BY 3, 2;
END $$;

GRANT EXECUTE ON FUNCTION public.register_player(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_score(uuid, uuid, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.global_leaderboard(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_leaderboard(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_players(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, uuid, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_friends(uuid, uuid) TO anon, authenticated;