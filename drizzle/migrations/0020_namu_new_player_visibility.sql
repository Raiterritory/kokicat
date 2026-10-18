CREATE OR REPLACE FUNCTION public.namu_visible_to_viewer(viewer_nickname text, viewer_created_at timestamptz, is_self boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT is_self OR (viewer_created_at > '2026-10-18T18:33:06Z'::timestamptz AND lower(btrim(viewer_nickname)) NOT IN ('raiterritory','mimi','naomi','nanairo','naomis'));
$$;
REVOKE ALL ON FUNCTION public.namu_visible_to_viewer(text,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.player_visible_to_viewer(p_target uuid, p_viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT COALESCE((SELECT CASE WHEN lower(target.nickname) = 'namu'
 THEN public.namu_visible_to_viewer(viewer.nickname, viewer.created_at, target.id = p_viewer)
 ELSE NOT target.hidden_from_ranking OR target.id = p_viewer END
 FROM public.players target LEFT JOIN public.players viewer ON viewer.id = p_viewer
 WHERE target.id = p_target), false);
$$;
REVOKE ALL ON FUNCTION public.player_visible_to_viewer(uuid,uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.global_leaderboard_for_player(p_mode text, p_id uuid DEFAULT NULL, p_secret uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, nickname text, score integer, skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF p_id IS NOT NULL OR p_secret IS NOT NULL THEN PERFORM public._auth_player(p_id,p_secret); END IF;
 IF p_mode NOT IN ('normal','hard','taz') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
 RETURN QUERY SELECT p.id,p.nickname,CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END,p.skin
 FROM public.players p WHERE public.player_visible_to_viewer(p.id,p_id)
 ORDER BY 3 DESC,p.created_at ASC LIMIT LEAST(GREATEST(p_limit,1),100);
END; $$;
GRANT EXECUTE ON FUNCTION public.global_leaderboard_for_player(text,uuid,uuid,integer) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.daily_leaderboard_for_player(p_day date, p_id uuid DEFAULT NULL, p_secret uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, nickname text, score integer, skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF p_id IS NOT NULL OR p_secret IS NOT NULL THEN PERFORM public._auth_player(p_id,p_secret); END IF;
 RETURN QUERY SELECT p.id,p.nickname,d.score,p.skin FROM public.daily_scores d JOIN public.players p ON p.id=d.player_id
 WHERE d.day=p_day AND public.player_visible_to_viewer(p.id,p_id)
 ORDER BY d.score DESC LIMIT LEAST(GREATEST(p_limit,1),100);
END; $$;
GRANT EXECUTE ON FUNCTION public.daily_leaderboard_for_player(date,uuid,uuid,integer) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.friends_leaderboard(p_id uuid,p_secret uuid,p_mode text)
RETURNS TABLE(id uuid,nickname text,score integer,skin text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM public._auth_player(p_id,p_secret);
 IF p_mode NOT IN ('normal','hard','taz') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
 RETURN QUERY WITH friends AS (
 SELECT f.addressee AS fid FROM public.friendships f WHERE f.requester=p_id AND f.accepted
 UNION SELECT f.requester FROM public.friendships f WHERE f.addressee=p_id AND f.accepted
 UNION SELECT p_id)
 SELECT p.id,p.nickname,CASE p_mode WHEN 'hard' THEN p.best_hard WHEN 'taz' THEN p.best_taz ELSE p.best_normal END,p.skin
 FROM public.players p JOIN friends fr ON fr.fid=p.id WHERE public.player_visible_to_viewer(p.id,p_id)
 ORDER BY 3 DESC,p.created_at ASC;
END; $$;
CREATE OR REPLACE FUNCTION public.search_players(p_id uuid,p_secret uuid,p_query text)
RETURNS TABLE(id uuid,nickname text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM public._auth_player(p_id,p_secret);
 IF length(btrim(p_query)) < 2 THEN RETURN; END IF;
 RETURN QUERY SELECT p.id,p.nickname FROM public.players p
 WHERE p.id <> p_id AND public.player_visible_to_viewer(p.id,p_id)
 AND p.nickname ILIKE '%' || replace(replace(btrim(p_query),'%',''),'_','\_') || '%'
 ORDER BY length(p.nickname) LIMIT 15;
END; $$;
CREATE OR REPLACE FUNCTION public.my_friends(p_id uuid,p_secret uuid)
RETURNS TABLE(id uuid,nickname text,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM public._auth_player(p_id,p_secret);
 RETURN QUERY SELECT p.id,p.nickname,CASE WHEN f.accepted THEN 'friend' WHEN f.requester=p_id THEN 'sent' ELSE 'incoming' END
 FROM public.friendships f JOIN public.players p ON p.id=CASE WHEN f.requester=p_id THEN f.addressee ELSE f.requester END
 WHERE (f.requester=p_id OR f.addressee=p_id) AND public.player_visible_to_viewer(p.id,p_id)
 ORDER BY 3,2;
END; $$;