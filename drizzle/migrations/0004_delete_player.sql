-- Permite que un jugador borre su propia cuenta online (y sus amistades, por ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION public.delete_player(p_id uuid, p_secret uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _auth_player(p_id, p_secret);
  DELETE FROM players WHERE id = p_id;
END $$;

GRANT EXECUTE ON FUNCTION public.delete_player(uuid, uuid) TO anon, authenticated;
