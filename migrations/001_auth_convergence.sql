-- ============================================================
-- Migración 001: Convergencia de autenticación entre la app
-- móvil ControlAsistencia y el ERP MAMKAM.
--
-- Aditiva: usa IF NOT EXISTS y DEFAULTs. Se puede correr
-- múltiples veces sin efecto colateral.
-- ============================================================

-- 1) Tabla empresas_tenant
CREATE TABLE IF NOT EXISTS empresas_tenant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut             VARCHAR(12) UNIQUE NOT NULL,
  razon_social    VARCHAR(300) NOT NULL,
  nombre_fantasia VARCHAR(300),
  email_contacto  VARCHAR(255) NOT NULL,
  telefono        VARCHAR(20),
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Columnas faltantes en usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS hash_method     VARCHAR(10) DEFAULT 'sha256',
  ADD COLUMN IF NOT EXISTS activo          BOOLEAN     DEFAULT true,
  ADD COLUMN IF NOT EXISTS reset_token     VARCHAR(6),
  ADD COLUMN IF NOT EXISTS reset_token_exp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS empresa_id      UUID REFERENCES empresas_tenant(id),
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Marcar como bcrypt los usuarios cuyo hash parece bcrypt
UPDATE usuarios
   SET hash_method = 'bcrypt'
 WHERE (hash_method IS NULL OR hash_method = 'sha256')
   AND password_hash LIKE '$2%';

-- 3) Columnas faltantes en trabajadores
-- Nota: trabajadores.id y usuarios.id son TEXT en esta BD, así que
-- supervisor_id y usuario_id deben ser TEXT (no UUID) para que la FK funcione.
ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS apellidos     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS email         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rol           VARCHAR(30) DEFAULT 'trabajador',
  ADD COLUMN IF NOT EXISTS empresa_id    UUID REFERENCES empresas_tenant(id),
  ADD COLUMN IF NOT EXISTS app_activa    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS permisos      JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS horario       JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- supervisor_id y usuario_id: detectar el tipo real de la PK antes de crear FK
DO $do$
DECLARE
  trab_id_type TEXT;
  user_id_type TEXT;
BEGIN
  SELECT data_type INTO trab_id_type
    FROM information_schema.columns
   WHERE table_name = 'trabajadores' AND column_name = 'id';

  SELECT data_type INTO user_id_type
    FROM information_schema.columns
   WHERE table_name = 'usuarios' AND column_name = 'id';

  -- supervisor_id (autoreferencia a trabajadores)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'trabajadores' AND column_name = 'supervisor_id'
  ) THEN
    EXECUTE format('ALTER TABLE trabajadores ADD COLUMN supervisor_id %s', trab_id_type);
    EXECUTE 'ALTER TABLE trabajadores ADD CONSTRAINT trabajadores_supervisor_id_fkey '
         || 'FOREIGN KEY (supervisor_id) REFERENCES trabajadores(id)';
  END IF;

  -- usuario_id (referencia a usuarios)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'trabajadores' AND column_name = 'usuario_id'
  ) THEN
    EXECUTE format('ALTER TABLE trabajadores ADD COLUMN usuario_id %s', user_id_type);
    EXECUTE 'ALTER TABLE trabajadores ADD CONSTRAINT trabajadores_usuario_id_fkey '
         || 'FOREIGN KEY (usuario_id) REFERENCES usuarios(id)';
  END IF;
END $do$;

-- 4) Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_rut
  ON usuarios(rut)
  WHERE deleted_at IS NULL AND rut IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trabajadores_empresa  ON trabajadores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_usuario  ON trabajadores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_rol      ON trabajadores(rol);

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trabajadores_updated_at ON trabajadores;
CREATE TRIGGER trg_trabajadores_updated_at
  BEFORE UPDATE ON trabajadores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_empresas_tenant_updated_at ON empresas_tenant;
CREATE TRIGGER trg_empresas_tenant_updated_at
  BEFORE UPDATE ON empresas_tenant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
