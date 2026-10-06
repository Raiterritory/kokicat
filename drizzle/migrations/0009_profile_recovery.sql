-- Recuperar el perfil si se borra la app: código de recuperación + copia del guardado en la nube.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS recovery_code text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS save_data jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS players_recovery_code ON public.players (recovery_code) WHERE recovery_code IS NOT NULL;

-- Devuelve el código del jugador (16 caracteres hexadecimales al azar); lo crea la primera vez.
CREATE OR REPLACE FUNCTION public.get_recovery_code(p_id uuid, p_secret uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  SELECT recovery_code INTO c FROM players WHERE id = p_id;
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      UPDATE players SET recovery_code = c WHERE id = p_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- código repetido (casi imposible): se genera otro
    END;
  END LOOP;
  RETURN c;
END $$;
GRANT EXECUTE ON FUNCTION public.get_recovery_code(uuid, uuid) TO anon, authenticated;

-- Copia del guardado (pastelitos, personajes, récords, skin) para poder recuperarlo.
CREATE OR REPLACE FUNCTION public.save_profile(p_id uuid, p_secret uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR length(p_data::text) > 8000 THEN RETURN; END IF;
  UPDATE players SET save_data = p_data WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.save_profile(uuid, uuid, jsonb) TO anon, authenticated;

-- Con el apodo y el código devuelve el usuario y su guardado.
CREATE OR REPLACE FUNCTION public.recover_player(p_nick text, p_code text)
RETURNS TABLE(id uuid, secret uuid, nickname text, save_data jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
BEGIN
  IF length(c) <> 16 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  RETURN QUERY
    SELECT p.id, p.secret, p.nickname, p.save_data FROM players p
    WHERE lower(p.nickname) = lower(btrim(p_nick)) AND p.recovery_code = c;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.recover_player(text, text) TO anon, authenticated;
