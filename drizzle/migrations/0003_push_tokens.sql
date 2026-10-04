-- Teléfonos de cada jugador para notificaciones push (Firebase Cloud Messaging).
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token text PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_player ON public.push_tokens (player_id);
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- Sin acceso directo desde la app: se guarda con la función de abajo y lo lee el servidor.

CREATE OR REPLACE FUNCTION public.save_push_token(p_id uuid, p_secret uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 4096 THEN RETURN; END IF;
  INSERT INTO push_tokens(token, player_id, updated_at) VALUES (p_token, p_id, now())
  ON CONFLICT (token) DO UPDATE SET player_id = EXCLUDED.player_id, updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.save_push_token(uuid, uuid, text) TO anon, authenticated;
