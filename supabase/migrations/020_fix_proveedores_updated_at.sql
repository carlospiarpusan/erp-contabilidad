ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE proveedores
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_proveedores ON proveedores;

CREATE TRIGGER set_updated_at_proveedores
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
