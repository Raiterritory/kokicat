-- Contraseña para recuperar el usuario (se guarda cifrada con bcrypt; nunca en texto plano).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS login_fails int NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS login_locked_until timestamptz;

-- ¿Este usuario ya tiene contraseña? (la app pide crearla si no)
CREATE OR REPLACE FUNCTION public.has_password(p_id uuid, p_secret uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  RETURN EXISTS (SELECT 1 FROM players WHERE id = p_id AND password_hash IS NOT NULL);
END $$;
GRANT EXECUTE ON FUNCTION public.has_password(uuid, uuid) TO anon, authenticated;

-- Crear o cambiar la contraseña (6 a 64 caracteres)
CREATE OR REPLACE FUNCTION public.set_password(p_id uuid, p_secret uuid, p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_password IS NULL OR length(p_password) < 6 OR length(p_password) > 64 THEN RAISE EXCEPTION 'invalid_password'; END IF;
  UPDATE players
     SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)),
         login_fails = 0, login_locked_until = NULL
   WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_password(uuid, uuid, text) TO anon, authenticated;

-- Entrar con apodo + contraseña: devuelve el usuario y su respaldo.
-- Tras 5 intentos fallidos el usuario queda bloqueado 10 minutos.
CREATE OR REPLACE FUNCTION public.login_player(p_nick text, p_password text)
RETURNS TABLE(id uuid, secret uuid, nickname text, save_data jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r players%ROWTYPE;
BEGIN
  SELECT * INTO r FROM players p WHERE lower(p.nickname) = lower(btrim(p_nick));
  IF NOT FOUND OR r.password_hash IS NULL THEN RAISE EXCEPTION 'invalid_login'; END IF;
  IF r.login_locked_until IS NOT NULL AND r.login_locked_until > now() THEN RAISE EXCEPTION 'locked'; END IF;
  IF extensions.crypt(coalesce(p_password, ''), r.password_hash) <> r.password_hash THEN
    UPDATE players SET
      login_fails = CASE WHEN r.login_fails + 1 >= 5 THEN 0 ELSE r.login_fails + 1 END,
      login_locked_until = CASE WHEN r.login_fails + 1 >= 5 THEN now() + interval '10 minutes' ELSE NULL END
    WHERE players.id = r.id;
    RETURN; -- sin filas = contraseña incorrecta (se devuelve así para que el contador quede guardado)
  END IF;
  UPDATE players SET login_fails = 0, login_locked_until = NULL WHERE players.id = r.id;
  RETURN QUERY SELECT r.id, r.secret, r.nickname, r.save_data;
END $$;
GRANT EXECUTE ON FUNCTION public.login_player(text, text) TO anon, authenticated;