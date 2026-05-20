# ControlAsistencia — Documentación Técnica y Funcional

Versión: 1.0
Stack: Expo (React Native) + Expo Router + React Query + Supabase
Plataformas: iOS / Android / Web
Lenguaje: TypeScript (strict)

---

## 1. Resumen ejecutivo

ControlAsistencia es una aplicación móvil multiplataforma para la gestión de personal en terreno. Permite registrar asistencia con validación por geocerca, administrar gastos, solicitar vacaciones, gestionar omisión de colación y administrar trabajadores, horarios y puntos de trabajo desde un panel de administrador.

Objetivos principales:
- Asegurar que las marcaciones se realicen dentro de la ubicación asignada.
- Formalizar flujos de aprobación (gastos, vacaciones, omitir colación, reset de contraseña).
- Centralizar la información en Supabase como fuente única de verdad.
- Entregar a la administración una vista en tiempo real de la asistencia del equipo.

---

## 2. Roles del sistema

| Rol | Descripción |
|---|---|
| **Trabajador** | Marca asistencia, registra gastos, solicita vacaciones y omitir colación. |
| **Supervisor** | Mismas capacidades operativas que el trabajador. |
| **Administrador** | Gestiona trabajadores, horarios, puntos de trabajo y todas las aprobaciones. |

Matriz de permisos: ver TUTORIAL.md §2.

---

## 3. Arquitectura del proyecto

### 3.1 Estructura de carpetas

```
expo/
├── app/                         # Rutas (Expo Router)
│   ├── _layout.tsx              # Root layout + providers + AuthGate
│   ├── login.tsx                # Inicio de sesión por RUT
│   ├── forgot.tsx               # Solicitud de reset de contraseña
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
├── contexts/                    # Estado global (create-context-hook)
│   ├── AuthContext.tsx
│   ├── MarcacionesContext.tsx
│   ├── GastosContext.tsx
│   └── VacacionesContext.tsx
├── services/                    # Acceso a datos
│   ├── supabase.ts              # Cliente Supabase
│   ├── repository.ts            # Repositorio de trabajadores/puntos/asignaciones
│   ├── marcaciones.ts           # CRUD marcaciones + solicitudes colación
│   ├── gastos.ts                # CRUD gastos
│   └── vacaciones.ts            # CRUD solicitudes de vacaciones
├── types/index.ts               # Tipos de dominio + paleta COLORS + mocks
├── constants/colors.ts
└── utils/                       # Utilidades (geocerca, fechas, días hábiles)
```

### 3.2 Navegación (Expo Router)

- **Root Stack** en `app/_layout.tsx` con rutas modales (forgot, formularios, puntos, vacaciones) y tabs protegidas.
- **AuthGate**: redirige automáticamente entre `/login` y `/(tabs)` según `isAuthenticated`.
- **Tabs dinámicas** en `app/(tabs)/_layout.tsx`:
  - Trabajador: Inicio, Historial, Gastos, Perfil.
  - Admin: Panel, Asistencia hoy, Gastos, Perfil (tab "Inicio" oculta).

### 3.3 Estado global

`@nkzw/create-context-hook` para cada dominio:

| Provider | Responsabilidad |
|---|---|
| `AuthContext` | Login por RUT, sesión persistida, logout, reset de contraseña. |
| `MarcacionesContext` | Marcaciones del día, jornada actual, solicitudes de omitir colación. |
| `GastosContext` | Gastos del trabajador/equipo, aprobaciones. |
| `VacacionesContext` | Solicitudes de vacaciones, validación de días hábiles, aprobaciones. |

React Query (`@tanstack/react-query`) envuelve los providers para cachear y revalidar datos de Supabase.

### 3.4 Capa de datos (Supabase)

Tablas utilizadas:

- `trabajadores` — usuarios del sistema con rol, horario y supervisor.
- `puntos_trabajo` — lugares con geocerca (lat/lng/radio).
- `asignaciones` — vínculo trabajador ↔ punto con vigencia.
- `marcaciones` — eventos de entrada/colación/salida con geolocalización.
- `gastos` — gastos con comprobante y estado.
- `solicitudes_password` — solicitudes de recuperación de contraseña.
- `solicitudes_omitir_colacion` — solicitudes para saltar colación.
- `solicitudes_vacaciones` — solicitudes de vacaciones con rango y días hábiles.

Acceso centralizado en `services/*.ts` mediante el cliente creado en `services/supabase.ts`.

---

## 4. Modelo de datos (TypeScript)

Definido en `types/index.ts`:

- `Trabajador` — incluye `HorarioTrabajador` embebido.
- `HorarioTrabajador` — `hora_entrada`, `hora_salida`, `minutos_colacion`, `usa_colacion`, `horas_jornada`, `tolerancia_minutos`, `dias_laborables[]`.
- `PuntoTrabajo` — coordenadas y `radio_permitido_metros`.
- `AsignacionTrabajo` — vigencia por rango de fechas.
- `Marcacion` — `tipo_marcacion`, timestamps servidor/dispositivo, lat/lng, `distancia_al_punto`, `dentro_geocerca`, `estado_validacion` (`valida | pendiente_revision | alerta`).
- `Gasto` — monto, moneda, `categoria`, comercio, tipo documento, `foto_url`, estado.
- `SolicitudVacaciones` — rango, `dias_habiles`, estado, comentario admin.
- `SolicitudOmitirColacion` — por fecha y trabajador.
- `SolicitudPassword` — por RUT + teléfono.

Todas las entidades manejan estado (`pendiente | aprobada/resuelta | rechazada`) cuando aplica.

---

## 5. Funcionalidades por pantalla

### 5.1 Autenticación

- **`login.tsx`**: login con RUT + contraseña. Persistencia de sesión vía AsyncStorage.
- **`forgot.tsx`**: genera una `solicitud_password` pendiente. El admin resuelve y la contraseña vuelve a `123456`.

### 5.2 Trabajador

| Pantalla | Funcionalidad |
|---|---|
| `(tabs)/index.tsx` | Dashboard: hora en vivo, estado jornada, geocerca, botón secuencial de marcación, solicitar no almorzar, actividad reciente. |
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
| `trabajador-form.tsx` | Alta/edición de trabajador + configuración completa de horario. |
| `puntos.tsx` + `punto-form.tsx` | CRUD de puntos de trabajo con geocerca (radio en metros). |
| `(tabs)/asistencia-hoy.tsx` | Panel en vivo de asistencia del día: presentes, atrasados, en colación, finalizados, ausentes. |
| `(tabs)/gastos.tsx` (admin) | Aprobación/rechazo de gastos del equipo. |
| `vacaciones.tsx` (admin) | Tabs pendientes/aprobadas/rechazadas con aprobación y comentarios. |

---

## 6. Reglas de negocio

### 6.1 Validación de marcación
- Se obtiene ubicación (precisión alta). Si falta permiso → estado **alerta**.
- Se calcula distancia al punto asignado (fórmula haversine en `utils/`).
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
- Contraseña inicial para todo trabajador creado: `123456`.
- Reset administrativo devuelve la contraseña a `123456`.

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

Reset de contraseña:
  Trabajador → forgot (RUT + teléfono) → estado=pendiente
    → Admin resuelve ⇒ password = 123456
```

---

## 8. Compatibilidad multiplataforma

- **Ubicación**: `expo-location` en nativo; `navigator.geolocation` en web.
- **Almacenamiento**: `AsyncStorage` en nativo; polyfill a `localStorage` en web.
- **Cámara/foto de gasto**: `expo-image-picker` en nativo; input file en web.
- **Haptics**: `expo-haptics` (no-op en web).
- Todas las pantallas principales verificadas en Expo Web.

---

## 9. Seguridad

- Las contraseñas se almacenan hasheadas en Supabase (los servicios no exponen el hash al cliente).
- Las operaciones críticas (aprobaciones) validan el rol antes de ejecutarse.
- Las rutas protegidas se controlan en `AuthGate`.
- Las claves públicas (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) están configuradas por entorno.

---

## 10. Variables de entorno

| Variable | Uso |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Endpoint Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Token público Supabase |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Autocompletado de direcciones en puntos de trabajo |
| `EXPO_PUBLIC_PROJECT_ID` / `EXPO_PUBLIC_TEAM_ID` | Identificadores de proyecto |

---

## 11. Mantenimiento

- **Agregar una nueva entidad**: crear tipo en `types/index.ts`, servicio en `services/`, provider en `contexts/` y pantalla/formulario en `app/`.
- **Agregar una regla de negocio**: centralizar en `utils/` para mantenerla testeable.
- **Ajustar la paleta**: modificar `COLORS` en `types/index.ts`.
- **Cambios en Supabase**: reflejar el esquema en los tipos de `types/index.ts` y adaptar los `services/*.ts`.

---

## 12. Roadmap sugerido

- Notificaciones push para aprobaciones.
- Exportación de reportes (Excel/PDF) de asistencia, HE y gastos.
- Marcación offline con cola de sincronización.
- Firma digital del comprobante de gasto.
- Auditoría (log) de acciones administrativas.

---

## 13. Referencias internas

- Manual de usuario: `TUTORIAL.md`.
- Tipos y mocks: `types/index.ts`.
- Servicios: `services/*.ts`.
- Providers: `contexts/*.tsx`.
