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
ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS apellidos     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS email         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rol           VARCHAR(30) DEFAULT 'trabajador',
  ADD COLUMN IF NOT EXISTS empresa_id    UUID REFERENCES empresas_tenant(id),
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES trabajadores(id),
  ADD COLUMN IF NOT EXISTS usuario_id    UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS app_activa    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS permisos      JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS horario       JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

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
