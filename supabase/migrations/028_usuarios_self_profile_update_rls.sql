-- Permite que cada usuario actualice solo su propio perfil básico
-- sin abrir cambios de rol, empresa, email o estado.

DROP POLICY IF EXISTS "usuario actualiza su propio perfil" ON usuarios;

CREATE POLICY "usuario actualiza su propio perfil" ON usuarios
  FOR UPDATE
  USING (
    id = auth.uid()
    AND activo = TRUE
  )
  WITH CHECK (
    id = auth.uid()
    AND empresa_id = get_empresa_id()
    AND activo = TRUE
  );

CREATE OR REPLACE FUNCTION public.guard_usuario_self_profile_update()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.id = auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
      OR NEW.rol_id IS DISTINCT FROM OLD.rol_id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.activo IS DISTINCT FROM OLD.activo
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Solo puedes actualizar nombre o telefono en tu perfil';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_usuario_self_profile_update ON public.usuarios;

CREATE TRIGGER trg_guard_usuario_self_profile_update
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_usuario_self_profile_update();
