-- Guarda los récords tal como están en el teléfono (también pueden bajar, p. ej. al reiniciar datos).
CREATE OR REPLACE FUNCTION public.set_score(p_id uuid, p_secret uuid, p_normal int, p_hard int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  UPDATE players SET
    best_normal = LEAST(GREATEST(COALESCE(p_normal, 0), 0), 100000),
    best_hard = LEAST(GREATEST(COALESCE(p_hard, 0), 0), 100000),
    updated_at = now()
  WHERE id = p_id;
END $$;

GRANT EXECUTE ON FUNCTION public.set_score(uuid, uuid, int, int) TO anon, authenticated;
