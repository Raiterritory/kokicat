-- Panel de administración: solo usuarios marcados como admin pueden usar estas funciones.
-- (Requiere 0011_player_password.)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE public.players SET is_admin = true WHERE lower(nickname) = 'raiterritory';

CREATE OR REPLACE FUNCTION public._auth_admin(p_id uuid, p_secret uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_id AND secret = p_secret AND is_admin) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._auth_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ¿El usuario de este teléfono es administrador?
CREATE OR REPLACE FUNCTION public.admin_check(p_id uuid, p_secret uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE id = p_id AND secret = p_secret AND is_admin);
$$;
GRANT EXECUTE ON FUNCTION public.admin_check(uuid, uuid) TO anon, authenticated;

-- Buscar jugadores por apodo (vacío = los más recientes)
CREATE OR REPLACE FUNCTION public.admin_find_players(p_id uuid, p_secret uuid, p_query text)
RETURNS TABLE(id uuid, nickname text, best_normal int, best_hard int, has_password boolean, has_code boolean, is_admin boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_admin(p_id, p_secret);
  RETURN QUERY
    SELECT p.id, p.nickname, p.best_normal, p.best_hard, p.password_hash IS NOT NULL, p.recovery_code IS NOT NULL, p.is_admin, p.created_at
    FROM players p
    WHERE coalesce(btrim(p_query), '') = '' OR p.nickname ILIKE '%' || replace(replace(btrim(p_query), '%', ''), '_', '\_') || '%'
    ORDER BY p.created_at DESC
    LIMIT 30;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_find_players(uuid, uuid, text) TO anon, authenticated;

-- Poner una contraseña nueva a un jugador (y desbloquearlo)
CREATE OR REPLACE FUNCTION public.admin_set_password(p_id uuid, p_secret uuid, p_target uuid, p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_admin(p_id, p_secret);
  IF p_password IS NULL OR length(p_password) < 6 OR length(p_password) > 64 THEN RAISE EXCEPTION 'invalid_password'; END IF;
  UPDATE players
     SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)),
         login_fails = 0, login_locked_until = NULL
   WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_password(uuid, uuid, uuid, text) TO anon, authenticated;

-- Ver (o crear) el código de recuperación de un jugador
CREATE OR REPLACE FUNCTION public.admin_recovery_code(p_id uuid, p_secret uuid, p_target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  PERFORM _auth_admin(p_id, p_secret);
  SELECT recovery_code INTO c FROM players WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      UPDATE players SET recovery_code = c WHERE id = p_target;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
    END;
  END LOOP;
  RETURN c;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_recovery_code(uuid, uuid, uuid) TO anon, authenticated;

-- Borrar un jugador (no se puede borrar a sí mismo ni a otro admin)
CREATE OR REPLACE FUNCTION public.admin_delete_player(p_id uuid, p_secret uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_admin(p_id, p_secret);
  IF p_target = p_id OR EXISTS (SELECT 1 FROM players WHERE id = p_target AND is_admin) THEN RAISE EXCEPTION 'protected'; END IF;
  DELETE FROM players WHERE id = p_target;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_player(uuid, uuid, uuid) TO anon, authenticated;
