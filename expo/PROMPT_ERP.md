# PROMPT — Claude Code · ERP MAMKAM
## Módulo: convergencia con app móvil ControlAsistencia

Este documento describe los cambios que deben aplicarse en el **ERP web MAMKAM** para mantener compatibilidad con la app móvil **ControlAsistencia**. Ambos sistemas comparten la misma base de datos Supabase, por lo que los cambios deben aplicarse **una sola vez** (el primero que aplique las migraciones gana — están escritas con `IF NOT EXISTS`).

---

## CONTEXTO

- **ERP MAMKAM** → app web. Login por **email + bcrypt**. Gestiona empresas, trabajadores, sueldos, facturación, etc.
- **ControlAsistencia** → app móvil (Expo / React Native). Login por **RUT + SHA-256**. Gestiona marcaciones, gastos, vacaciones del trabajador en terreno.

Ambos leen/escriben en las mismas tablas Supabase: `usuarios`, `trabajadores`, `empresas` (o `empresas_tenant`).

El discriminador de algoritmo de contraseña es la columna `hash_method` en `usuarios`:
- `'sha256'` → usuario creado desde la app móvil (login con RUT).
- `'bcrypt'` → usuario creado desde el ERP (login con email).

---

## 1. MIGRACIONES SQL A APLICAR EN SUPABASE

> Estas migraciones son **aditivas**. Usan `IF NOT EXISTS` y `DEFAULT` para no romper datos existentes.

Archivo: `expo/migrations/001_auth_convergence.sql` (también disponible en el repo de la app móvil).

```sql
-- =====================================================
-- 1) empresas_tenant (si no existe ya como `empresas`)
-- =====================================================
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

-- =====================================================
-- 2) usuarios (columnas faltantes)
-- =====================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS hash_method     VARCHAR(10) DEFAULT 'sha256',
  ADD COLUMN IF NOT EXISTS activo          BOOLEAN     DEFAULT true,
  ADD COLUMN IF NOT EXISTS reset_token     VARCHAR(6),
  ADD COLUMN IF NOT EXISTS reset_token_exp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS empresa_id      UUID REFERENCES empresas_tenant(id),
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Marcar como bcrypt los usuarios existentes del ERP (hashes que empiezan con $2)
UPDATE usuarios
   SET hash_method = 'bcrypt'
 WHERE hash_method = 'sha256'
   AND password_hash LIKE '$2%';

-- =====================================================
-- 3) trabajadores (columnas para gestión desde la app)
-- =====================================================
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

-- =====================================================
-- 4) Índices
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_rut
  ON usuarios(rut)
  WHERE deleted_at IS NULL AND rut IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trabajadores_empresa  ON trabajadores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_usuario  ON trabajadores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_rol      ON trabajadores(rol);

-- =====================================================
-- 5) Trigger updated_at automático
-- =====================================================
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
```

---

## 2. CAMBIOS REQUERIDOS EN EL ERP

### 2.1. Login del ERP debe respetar `hash_method`

Hoy el ERP asume bcrypt para todos. Ahora hay usuarios con `hash_method = 'sha256'` (creados desde la app móvil). El login del ERP debe:

```ts
// Pseudocódigo
const user = await db.usuarios.findOne({ email, deleted_at: null });
if (!user) return error('credenciales');
if (!user.activo) return error('cuenta_desactivada');

const ok = user.hash_method === 'bcrypt'
  ? await bcrypt.compare(password, user.password_hash)
  : sha256Hex(password) === user.password_hash.toLowerCase();

if (!ok) return error('credenciales');
```

> **Importante:** los usuarios creados desde la app móvil podrían no tener `email` (solo RUT). Si el ERP exige email, mostrar mensaje: *"Este usuario fue creado desde la app móvil. Pídele a tu administrador que le asigne un email para acceder al ERP."*

### 2.2. Al crear un usuario en el ERP, setear correctamente los campos nuevos

```sql
INSERT INTO usuarios
  (id, email, rut, password_hash, hash_method, rol, empresa_id, activo, nombre)
VALUES
  (gen_random_uuid(), $email, $rut, $bcryptHash, 'bcrypt', $rol, $empresaId, true, $nombre);
```

- `hash_method = 'bcrypt'` siempre que el ERP genere la contraseña.
- Si el usuario también debe usar la app móvil → crear un registro en `trabajadores` con `usuario_id = usuarios.id` y `rol = usuarios.rol`.

### 2.3. Reset de contraseña desde el ERP

Cuando un admin resetea la contraseña de un trabajador desde el ERP:
- Si el trabajador usa la **app móvil** (tiene `rut` y no tiene email del corporativo), guardar el nuevo hash con **SHA-256** y `hash_method = 'sha256'`.
- Si solo usa el ERP, mantener bcrypt.

```ts
const newPasswordHash = targetUser.hash_method === 'sha256'
  ? sha256Hex(newPassword)
  : await bcrypt.hash(newPassword, 10);

await db.usuarios.update(targetUser.id, {
  password_hash: newPasswordHash,
  hash_method: targetUser.hash_method,
  reset_token: null,
  reset_token_exp: null,
});
```

### 2.4. Recuperación de contraseña por código (admin/supervisor)

La app móvil ya implementa el flujo: genera código de 6 dígitos, lo guarda en `usuarios.reset_token` con expiración `reset_token_exp = NOW() + INTERVAL '10 minutes'`, y lo envía por EmailJS.

El ERP debería **respetar y usar las mismas columnas** (`reset_token`, `reset_token_exp`) si implementa flujo equivalente, para no pisar uno con otro.

### 2.5. Creación de empresa (onboarding) desde el ERP

Si el ERP permite crear nuevas empresas, debe insertar en `empresas_tenant` (no en `empresas` si esa tabla es legacy). La app móvil usa esta tabla como fuente canónica para el dropdown de empresas.

### 2.6. Soft-delete consistente

Tanto `usuarios.deleted_at` como `trabajadores.deleted_at` deben usarse como soft-delete. **No usar DELETE físico** — la app móvil filtra por `deleted_at IS NULL`.

### 2.7. Vínculo `trabajadores.usuario_id`

Cuando el ERP cree un trabajador que también tendrá login (en ERP o app), debe:
1. Crear el `usuario` primero.
2. Crear el `trabajador` con `usuario_id = usuarios.id`.
3. Asegurar que `trabajadores.empresa_id = usuarios.empresa_id`.

---

## 3. CONTRATOS DE DATOS (no romper)

La app móvil espera estos campos exactos. No los renombres ni cambies tipos:

### Tabla `usuarios`
| Columna           | Tipo         | Uso                                              |
|-------------------|--------------|--------------------------------------------------|
| `id`              | UUID         | PK                                               |
| `rut`             | varchar      | Login en app móvil (puede ser NULL en ERP-only)  |
| `email`           | varchar      | Login en ERP                                     |
| `nombre`          | varchar      | Nombre completo                                  |
| `password_hash`   | varchar      | Hash bcrypt o sha256 hex                         |
| `hash_method`     | varchar(10)  | `'sha256'` \| `'bcrypt'`                         |
| `rol`             | varchar(30)  | `trabajador` \| `supervisor` \| `administrador`  |
| `activo`          | bool         | App valida esto para permitir login              |
| `empresa_id`      | UUID         | FK → empresas_tenant                             |
| `reset_token`     | varchar(6)   | Código de 6 dígitos para reset                   |
| `reset_token_exp` | timestamptz  | Expiración del código                            |
| `deleted_at`      | timestamptz  | Soft delete                                      |

### Tabla `trabajadores`
| Columna        | Tipo         | Uso                                              |
|----------------|--------------|--------------------------------------------------|
| `id`           | UUID         | PK                                               |
| `usuario_id`   | UUID         | FK → usuarios.id (null si no usa login)          |
| `empresa_id`   | UUID         | FK → empresas_tenant                             |
| `rol`          | varchar(30)  | Mismo enum que `usuarios.rol`                    |
| `app_activa`   | bool         | Si false, la app móvil no le permite login       |
| `permisos`     | jsonb        | `{ puede_gastos, puede_vacaciones, ... }`        |
| `horario`     | jsonb        | `{ hora_entrada, hora_salida, ... }`             |

---

## 4. CHECKLIST DE ACEPTACIÓN

- [ ] Migraciones aplicadas en Supabase prod.
- [ ] Login del ERP funciona con usuarios `hash_method='sha256'` creados por la app móvil.
- [ ] Login de la app móvil funciona con usuarios `hash_method='bcrypt'` creados por el ERP (la app muestra mensaje sugiriendo recuperar desde la web — no se valida bcrypt en cliente).
- [ ] Crear usuario en ERP graba `hash_method='bcrypt'`.
- [ ] Crear usuario en app graba `hash_method='sha256'`.
- [ ] Reset desde ERP respeta `hash_method` del usuario destino.
- [ ] `trabajadores.usuario_id` se popula al crear cuentas de app desde cualquiera de los dos sistemas.
- [ ] Soft-delete: el ERP nunca borra filas físicamente.
- [ ] `empresas_tenant` es la tabla canónica (si antes era `empresas`, migrar datos).
