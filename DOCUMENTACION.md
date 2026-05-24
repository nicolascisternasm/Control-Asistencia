# ControlAsistencia — Documentación Técnica y Funcional

Versión: 1.1
Stack: Expo (React Native) + Expo Router + React Query + Supabase
Plataformas: iOS / Android / Web
Lenguaje: TypeScript (strict)

---

## 1. Resumen ejecutivo

ControlAsistencia es una aplicación móvil multiplataforma para la gestión de personal en terreno. Permite registrar asistencia con validación por geocerca, administrar gastos, solicitar vacaciones, gestionar omisión de colación y administrar trabajadores, horarios, empresas y puntos de trabajo desde un panel de administrador.

Objetivos principales:
- Asegurar que las marcaciones se realicen dentro de la ubicación asignada (geocerca).
- Formalizar flujos de aprobación (gastos, vacaciones, omitir colación, reset de contraseña).
- Centralizar la información en Supabase como fuente única de verdad (compartida con el ERP).
- Entregar a la administración una vista en tiempo real de la asistencia del equipo.

---

## 2. Roles y permisos

| Rol | Descripción |
|---|---|
| **Trabajador** | Marca asistencia, registra gastos, solicita vacaciones y omitir colación. |
| **Supervisor** | Mismas capacidades operativas que el trabajador, con acceso a vistas administrativas si el ERP así lo define. |
| **Administrador** | Gestiona trabajadores, horarios, puntos de trabajo y todas las aprobaciones. |

Adicionalmente, cada `Trabajador` puede tener un objeto `permisos` granular (`PermisosTrabajador`):

- `puede_marcaciones`, `puede_gastos`, `puede_vacaciones`, `puede_oc` (omitir colación)
- `puede_cotizar`, `puede_rrhh`, `puede_finanzas`

Estos permisos modulan qué módulos están visibles aunque el rol base sea `trabajador`.

Matriz de permisos detallada: ver `TUTORIAL.md` §2.

---

## 3. Arquitectura del proyecto

### 3.1 Estructura de carpetas

```
expo/
├── app/                         # Rutas (Expo Router)
│   ├── _layout.tsx              # Root layout + providers + AuthGate + ErrorBoundary
│   ├── login.tsx                # Inicio de sesión por RUT
│   ├── forgot.tsx               # Recuperación de contraseña (flujo por rol)
│   ├── trabajador-form.tsx      # Alta/edición de trabajador (modal)
│   ├── marcacion-detail.tsx     # Detalle de marcación (modal)
│   ├── puntos.tsx               # Listado de puntos de trabajo (modal)
│   ├── punto-form.tsx           # Alta/edición de punto (modal)
│   ├── gasto-form.tsx           # Alta de gasto (modal)
│   ├── vacaciones.tsx           # Listado/solicitudes de vacaciones (modal)
│   ├── vacacion-form.tsx        # Nueva solicitud de vacaciones (modal)
│   └── (tabs)/
│       ├── _layout.tsx          # Tabs dinámicas según rol
│       ├── index.tsx            # Dashboard trabajador
│       ├── history.tsx          # Historial de marcaciones
│       ├── gastos.tsx           # Gastos (vista por rol)
│       ├── asistencia-hoy.tsx   # Asistencia en vivo (admin)
│       ├── admin.tsx            # Panel de administración
│       └── profile.tsx          # Perfil del usuario
├── components/
│   └── ErrorBoundary.tsx        # Captura errores de render
├── contexts/                    # Estado global (@nkzw/create-context-hook)
│   ├── AuthContext.tsx
│   ├── MarcacionesContext.tsx
│   ├── GastosContext.tsx
│   ├── VacacionesContext.tsx
│   └── ToastContext.tsx
├── services/                    # Acceso a datos
│   ├── supabase.ts              # Cliente Supabase
│   ├── repository.ts            # Trabajadores, puntos, asignaciones, empresas
│   ├── marcaciones.ts           # CRUD marcaciones
│   ├── omitir-colacion.ts       # Solicitudes de omitir colación
│   ├── gastos.ts                # CRUD gastos
│   ├── vacaciones.ts            # CRUD vacaciones
│   └── emailjs.ts               # Envío de códigos de verificación por email
├── types/index.ts               # Tipos de dominio + paleta COLORS
├── fixtures/mock.ts             # Datos de ejemplo
├── constants/colors.ts
└── utils/                       # crypto (SHA-256), geo (haversine), fecha, horas, rut
```

### 3.2 Navegación (Expo Router)

- **Root Stack** en `app/_layout.tsx` envuelto en `ErrorBoundary` + providers + `AuthGate`.
- **AuthGate** redirige automáticamente entre `/login` y `/(tabs)` según `isAuthenticated`.
- **Tabs dinámicas** en `app/(tabs)/_layout.tsx`:
  - Trabajador: Inicio, Historial, Gastos, Perfil.
  - Admin: Inicio, Historial, Asistencia hoy, Gastos, Admin, Perfil.

### 3.3 Estado global

`@nkzw/create-context-hook` para cada dominio:

| Provider | Responsabilidad |
|---|---|
| `AuthContext` | Login por RUT + contraseña SHA-256, sesión persistida (AsyncStorage), logout, reset de contraseña. |
| `MarcacionesContext` | Marcaciones del día, jornada actual, solicitudes de omitir colación. |
| `GastosContext` | Gastos del trabajador/equipo, aprobaciones. |
| `VacacionesContext` | Solicitudes de vacaciones, validación de días hábiles, aprobaciones. |
| `ToastContext` | Notificaciones in-app no bloqueantes. |

React Query (`@tanstack/react-query`) es el provider top-level y cachea/revalida todos los datos de Supabase.

### 3.4 Capa de datos (Supabase)

Tablas utilizadas:

- `usuarios` — credenciales (RUT, `password_hash` SHA-256, rol, email, `empresa_ids`).
- `trabajadores` — datos del personal (cargo, horario, supervisor, `empresa_id`, sueldo, permisos).
- `empresas` — catálogo de empresas (se resuelve `empresa_id` → nombre legible).
- `puntos_trabajo` — lugares con geocerca (lat/lng/radio).
- `asignaciones` — vínculo trabajador ↔ punto con vigencia.
- `marcaciones` — eventos de entrada/colación/salida con geolocalización.
- `gastos` — gastos con comprobante y estado.
- `solicitudes_password` — solicitudes de recuperación (solo para trabajadores comunes).
- `solicitudes_omitir_colacion` — solicitudes para saltar colación.
- `solicitudes_vacaciones` — solicitudes de vacaciones con rango y días hábiles.

Acceso centralizado en `services/*.ts` mediante el cliente creado en `services/supabase.ts`.
`repository.ts` mantiene un cache (5 min) de `empresas` para resolver IDs a nombres.

---

## 4. Modelo de datos (TypeScript)

Definido en `types/index.ts`:

- `Trabajador` — incluye `rol`, `email`, `empresa` (nombre) + `empresa_id` (FK), `sueldo`, `permisos`, `app_activa`, `estado`, `horario` embebido.
- `HorarioTrabajador` — `hora_entrada`, `hora_salida`, `minutos_colacion`, `usa_colacion`, `horas_jornada`, `tolerancia_minutos`, `dias_laborables[]`.
- `PermisosTrabajador` — flags granulares por módulo.
- `PuntoTrabajo` — coordenadas y `radio_permitido_metros`.
- `AsignacionTrabajo` — vigencia por rango de fechas.
- `Marcacion` — `tipo_marcacion`, timestamps servidor/dispositivo, lat/lng, `distancia_al_punto`, `dentro_geocerca`, `estado_validacion` (`valida | pendiente_revision | alerta`).
- `Gasto` — monto, moneda, `categoria`, comercio, tipo documento, `foto_url`, estado, `empresa_id`.
- `SolicitudVacaciones` — rango, `dias_habiles`, estado, comentario admin.
- `SolicitudOmitirColacion` — por fecha y trabajador.
- `SolicitudPassword` — por RUT + teléfono (canal de trabajadores).

Todas las entidades manejan estado (`pendiente | aprobada/resuelta | rechazada`) cuando aplica.

---

## 5. Funcionalidades por pantalla

### 5.1 Autenticación

- **`login.tsx`**: ingreso por RUT + contraseña. La contraseña se hashea con **SHA-256** (`utils/crypto.ts`) y se compara contra `usuarios.password_hash`. Persistencia de sesión en AsyncStorage.
- **`forgot.tsx`**: flujo diferenciado por rol.
  - **Admin / Supervisor**: la app muestra el email enmascarado, envía un **código de 6 dígitos por EmailJS** (TTL 10 min). Una vez verificado, el usuario define la nueva contraseña y se actualiza `password_hash` directamente en Supabase.
  - **Trabajador**: mensaje "Contacta a tu administrador" (no expone email). El admin puede resetear desde el panel.
  - **RUT no existe**: feedback explícito.

### 5.2 Trabajador

| Pantalla | Funcionalidad |
|---|---|
| `(tabs)/index.tsx` | Dashboard: hora en vivo, estado de jornada, geocerca, botón secuencial de marcación, solicitar omitir colación, actividad reciente. |
| `(tabs)/history.tsx` | Historial filtrable por fecha con acceso a detalle. |
| `marcacion-detail.tsx` | Ubicación, distancia al punto, estado de validación y observaciones. |
| `(tabs)/gastos.tsx` | Lista propia + total del mes + acceso a `gasto-form`. |
| `gasto-form.tsx` | Alta de gasto (fecha, monto, moneda, categoría, comercio, tipo doc, foto). |
| `(tabs)/profile.tsx` | Datos personales + acceso a vacaciones + logout. |
| `vacaciones.tsx` | Solicitudes propias con estado. |
| `vacacion-form.tsx` | Nueva solicitud con validación de 5 días hábiles. |

### 5.3 Administrador

| Pantalla | Funcionalidad |
|---|---|
| `(tabs)/admin.tsx` | KPIs, alertas del día, solicitudes de contraseña y de omitir colación, listado de equipo con búsqueda, alta de trabajador. |
| `trabajador-form.tsx` | Alta/edición de trabajador: datos personales, rol, empresa, sueldo, **permisos granulares** y configuración completa de horario. |
| `puntos.tsx` + `punto-form.tsx` | CRUD de puntos de trabajo con geocerca (radio en metros) y autocompletado de dirección (Google Places). |
| `(tabs)/asistencia-hoy.tsx` | Panel en vivo: presentes, atrasados, en colación, finalizados, ausentes. |
| `(tabs)/gastos.tsx` (admin) | Aprobación/rechazo de gastos del equipo, filtros por empresa. |
| `vacaciones.tsx` (admin) | Tabs pendientes/aprobadas/rechazadas con aprobación y comentarios. |

---

## 6. Reglas de negocio

### 6.1 Validación de marcación
- Se obtiene ubicación (precisión alta). Si falta permiso → estado **alerta**.
- Se calcula distancia al punto asignado (haversine en `utils/geo.ts`).
- `distancia ≤ radio_permitido_metros` ⇒ **válida**. En caso contrario ⇒ **alerta**.
- Observación automática generada según caso.

### 6.2 Secuencia de marcaciones
Orden forzado: **entrada → salida_colacion → regreso_colacion → salida**. Si hay solicitud de omitir colación aprobada para la fecha, los pasos intermedios se bloquean.

### 6.3 Colación por minutos
La configuración del horario define `minutos_colacion` (cantidad total), no un rango horario. El trabajador puede iniciarla cuando corresponda en su jornada.

### 6.4 Horas extra
- `HE = max(0, hora_real_salida − hora_salida_planificada)`.
- Si la omisión de colación fue aprobada y el trabajador cumple el horario, los `minutos_colacion` se suman como HE.

### 6.5 Vacaciones — 5 días hábiles
- Validación en cliente antes de enviar: desde hoy hasta `fecha_desde` deben existir ≥ 5 días hábiles (L–V).
- `fecha_hasta ≥ fecha_desde`.
- `dias_habiles` calculado al guardar.

### 6.6 Omitir colación
- Queda **pendiente** hasta resolución del admin.
- Solo afecta al día solicitado.
- Una vez aprobada: botones de colación deshabilitados y jornada cuenta como HE si se cumple el horario.

### 6.7 Contraseñas
- Hash **SHA-256** hex (sin salt) — compatible con el esquema usado por el ERP que escribe en la misma tabla `usuarios`.
- Recuperación:
  - Admin/Supervisor: código por email (EmailJS) + reset directo desde la app.
  - Trabajador: requiere intervención del administrador.
- El admin puede resetear desde el panel de administración.

### 6.8 Resolución de empresa
- `trabajadores.empresa_id` guarda el **UUID** (FK a `empresas`).
- Al leer, `repository.ts` consulta la tabla `empresas` (cache 5 min) y resuelve el nombre legible en el campo `empresa`.
- Los filtros por empresa matchean tanto por nombre como por id para tolerar datos heredados.

---

## 7. Flujos (BPMN simplificado)

```
Marcación:
  Trabajador → Presiona botón → GPS → Validar geocerca
    → OK        ⇒ Registra marcación (estado=valida)
    → Fuera     ⇒ Registra marcación (estado=alerta) → notifica admin

Vacaciones:
  Trabajador → vacacion-form → Validar 5 días hábiles
    → Falla ⇒ bloquea envío
    → OK    ⇒ Supabase (estado=pendiente) → Admin decide → estado final

Omitir colación:
  Trabajador → solicitar → estado=pendiente
    → Admin aprueba  ⇒ bloquea colación + HE por minutos_colacion
    → Admin rechaza  ⇒ jornada normal

Gastos:
  Trabajador → gasto-form → estado=pendiente → Admin decide

Reset de contraseña (Admin/Supervisor):
  Usuario → forgot → app muestra email enmascarado
    → EmailJS envía código (TTL 10 min)
    → Usuario ingresa código → define nueva pass
    → SHA-256 → UPDATE usuarios.password_hash

Reset de contraseña (Trabajador):
  Trabajador → forgot → "Contacta a tu administrador"
    → Admin resuelve desde el panel
```

---

## 8. Compatibilidad multiplataforma

- **Ubicación**: `expo-location` en nativo; `navigator.geolocation` en web.
- **Almacenamiento**: `AsyncStorage` en nativo; polyfill a `localStorage` en web.
- **Cámara/foto de gasto**: `expo-image-picker` en nativo; input file en web.
- **Haptics**: `expo-haptics` (no-op en web).
- **Crypto (SHA-256)**: `expo-crypto` con fallback JS puro para web/tests.
- Todas las pantallas principales verificadas en Expo Web.

---

## 9. Seguridad

- Contraseñas hasheadas (SHA-256) antes de comparar/guardar. El cliente nunca recibe el hash de otro usuario en respuestas comunes.
- Las operaciones críticas (aprobaciones, reset) validan el rol antes de ejecutarse.
- Las rutas protegidas se controlan en `AuthGate`.
- `ErrorBoundary` evita crash total y reporta el componente que falló.
- Las claves públicas (`EXPO_PUBLIC_*`) son las únicas accesibles desde el bundle. No se incluyen secretos privados.

> **Nota**: SHA-256 sin salt es compatible con el ERP existente, pero se recomienda migrar a bcrypt/argon2 con salt en una iteración futura (ver Roadmap).

---

## 10. Variables de entorno

| Variable | Uso |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Endpoint Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Token público Supabase |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Autocompletado de direcciones en puntos de trabajo |
| `EXPO_PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS — clave pública |
| `EXPO_PUBLIC_EMAILJS_SERVICE_ID` | EmailJS — service id |
| `EXPO_PUBLIC_EMAILJS_TEMPLATE_ID` | EmailJS — template del código de verificación |
| `EXPO_PUBLIC_PROJECT_ID` / `EXPO_PUBLIC_TEAM_ID` | Identificadores de proyecto |

---

## 11. Mantenimiento

- **Agregar una nueva entidad**: crear tipo en `types/index.ts`, servicio en `services/`, provider en `contexts/` y pantalla/formulario en `app/`.
- **Agregar una regla de negocio**: centralizar en `utils/` para mantenerla testeable (existen tests Jest en `utils/__tests__/`).
- **Ajustar la paleta**: modificar `COLORS` en `types/index.ts`.
- **Cambios en Supabase**: reflejar el esquema en los tipos de `types/index.ts` y adaptar los `services/*.ts`.
- **Nuevos permisos granulares**: extender `PermisosTrabajador` y consumirlo en `trabajador-form.tsx` + la pantalla correspondiente.

---

## 12. Roadmap sugerido

- Migrar hashing de contraseñas a bcrypt/argon2 con salt (coordinar con ERP).
- Notificaciones push para aprobaciones y alertas de geocerca.
- Exportación de reportes (Excel/PDF) de asistencia, HE y gastos.
- Marcación offline con cola de sincronización.
- Firma digital del comprobante de gasto.
- Auditoría (log) de acciones administrativas.
- Reset de contraseña self-service también para trabajadores (vía SMS o email si está disponible).

---

## 13. Referencias internas

- Manual de usuario: `TUTORIAL.md`.
- Tipos: `types/index.ts`.
- Servicios: `services/*.ts`.
- Providers: `contexts/*.tsx`.
- Utilidades testeables: `utils/` (+ `utils/__tests__/`).
