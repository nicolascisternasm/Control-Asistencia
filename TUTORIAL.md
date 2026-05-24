# ControlAsistencia — Manual de Usuario y Funcionalidades

Versión: 1.1  
Tipo de aplicación: App móvil (iOS / Android / Web) construida con Expo + React Native  
Persistencia: Supabase (PostgreSQL)  
Roles: **Trabajador**, **Supervisor**, **Administrador**

---

## 1. Introducción

ControlAsistencia es una aplicación móvil para la gestión de:

- Marcaciones de asistencia con geolocalización (entrada, colación, salida).
- Registro y aprobación de gastos de trabajadores.
- Solicitudes de vacaciones con validación de anticipación mínima.
- Solicitudes para omitir colación (que cuenta como hora extra).
- Administración de trabajadores, horarios y puntos de trabajo (geocercas).
- Recuperación de contraseña diferenciada por rol: admin/supervisor con código por correo, trabajador con solicitud al administrador.

La aplicación está orientada a empresas con personal en terreno que requieren control horario preciso, validación de ubicación y flujo de aprobaciones.

---

## 2. Roles y permisos

| Función | Trabajador | Supervisor | Admin |
|---|:---:|:---:|:---:|
| Marcar asistencia | ✅ | ✅ | ✅ |
| Registrar gastos | ✅ | ✅ | ✅ |
| Solicitar vacaciones | ✅ | ✅ | ✅ |
| Solicitar omitir colación | ✅ | ✅ | ✅ |
| Ver asistencia de hoy del equipo | ❌ | ❌ | ✅ |
| Aprobar/Rechazar gastos | ❌ | ❌ | ✅ |
| Aprobar/Rechazar vacaciones | ❌ | ❌ | ✅ |
| Aprobar/Rechazar omitir colación | ❌ | ❌ | ✅ |
| Gestionar trabajadores | ❌ | ❌ | ✅ |
| Configurar horarios | ❌ | ❌ | ✅ |
| Gestionar puntos de trabajo | ❌ | ❌ | ✅ |
| Resolver solicitudes de contraseña de trabajadores | ❌ | ❌ | ✅ |
| Auto-recuperar contraseña por código al correo | ✅ (admin) | ✅ (supervisor) | ✅ |

---

## 3. Acceso a la aplicación

### 3.1 Iniciar sesión
1. Abrir la app.
2. Ingresar **RUT** y **contraseña**.
3. Presionar **Iniciar sesión**.

La contraseña inicial asignada por el admin al crear un trabajador es `123456` (debe cambiarse al primer ingreso si el flujo lo exige). Las contraseñas se almacenan en Supabase como **SHA-256** del texto plano (compatible con el ERP que alimenta la tabla `usuarios`).

### 3.2 Recuperar contraseña

El flujo depende del **rol** del usuario asociado al RUT ingresado.

#### 3.2.1 Administrador / Supervisor (auto-servicio por correo)
1. En la pantalla de login, presionar **¿Olvidaste tu contraseña?**.
2. Ingresar el RUT.
3. La app muestra el **correo enmascarado** asociado al usuario (ej. `n***@gmail.com`).
4. Presionar **Enviar código**: se envía un código de 6 dígitos al correo registrado mediante EmailJS.
5. Ingresar el código recibido.
6. Definir la nueva contraseña y confirmarla.
7. La app actualiza el `password_hash` (SHA-256 de la nueva clave) en Supabase y permite iniciar sesión inmediatamente.

#### 3.2.2 Trabajador
1. En la pantalla de login, presionar **¿Olvidaste tu contraseña?**.
2. Ingresar el RUT.
3. La app muestra el mensaje **"Contacta a tu administrador para restablecer tu contraseña"**. Por seguridad, los trabajadores no pueden auto-resetear.
4. El administrador la resuelve desde su panel; al aprobarla, la contraseña se restablece a `123456`.

---

## 4. Pantallas y funcionalidades (Trabajador)

### 4.1 Inicio (Dashboard)
Pantalla principal del trabajador. Muestra:

- Saludo, hora en vivo y fecha actual.
- Estado de la jornada: *Sin iniciar / En jornada / En colación / Jornada finalizada*.
- Punto de trabajo asignado y radio permitido (geocerca).
- Tarjeta de **Colación de hoy** con solicitud para omitir colación.
- Grilla de las 4 marcaciones del día: **Entrada, Salida a colación, Regreso de colación, Salida**.
- Botón principal de marcación (secuencial).
- Actividad reciente (últimas 5 marcaciones con estado).

**Caso de uso: marcar asistencia**
1. Situarse dentro de la geocerca del punto asignado.
2. Presionar el botón activo según corresponda (entrada, colación, etc.).
3. La app obtiene ubicación, valida contra geocerca y guarda la marcación con estado:
   - 🟢 **Válida**: dentro de la geocerca y en horario.
   - 🟡 **Pendiente de revisión**: fuera de tolerancia.
   - 🔴 **Alerta**: fuera de la geocerca o sin permiso de ubicación.

**Caso de uso: solicitar no almorzar hoy**
1. Presionar **Solicitar no almorzar hoy**.
2. Ingresar motivo y enviar.
3. Queda en estado **Pendiente** hasta que el admin la apruebe o rechace.
4. Si se aprueba: los botones de colación quedan bloqueados y la hora de colación se suma como hora extra si el trabajador sale puntual.

### 4.2 Historial
- Lista cronológica de todas las marcaciones del trabajador.
- Filtro por rango de fechas.
- Acceso al detalle de cada marcación (ubicación, distancia al punto, observaciones).

### 4.3 Gastos
- Resumen del total del mes en curso.
- Listado de gastos propios (pendientes, aprobados, rechazados).
- Botón **+ Nuevo gasto** para registrar.

**Caso de uso: registrar un gasto**
1. Presionar **+ Nuevo gasto**.
2. Completar: fecha, monto, moneda, categoría (combustible, alimentación, alojamiento, materiales, transporte, herramientas, otros), comercio, tipo de documento (boleta/factura/otro), descripción, foto del comprobante (opcional).
3. Enviar. El gasto queda **Pendiente** hasta aprobación del admin.

### 4.4 Perfil
- Datos personales (nombre, RUT, cargo, empresa).
- Acceso a **Solicitar vacaciones**.
- Acceso a **Mis solicitudes de vacaciones** con estado (pendiente/aprobada/rechazada).
- Cierre de sesión.

**Caso de uso: solicitar vacaciones**
1. Desde Perfil → **Solicitar vacaciones**.
2. Elegir **Fecha desde** y **Fecha hasta**.
3. La app valida:
   - Mínimo **5 días hábiles** de anticipación desde hoy hasta la fecha de inicio. Si no se cumple, la solicitud **no se puede enviar**.
   - La fecha hasta debe ser posterior o igual a la fecha desde.
4. Ingresar motivo y confirmar.
5. Se crea el registro en la app y en Supabase con estado **Pendiente**.
6. El trabajador puede ver sus solicitudes y su estado en tiempo real.

---

## 5. Pantallas y funcionalidades (Administrador)

### 5.1 Panel Admin
Centro de operaciones del administrador. Contiene:

- Métricas: N° de trabajadores, solicitudes de contraseña pendientes, alertas del día.
- Accesos rápidos a **Puntos de trabajo** y **Solicitudes de vacaciones**.
- Listado de **Solicitudes de contraseña** pendientes, con acciones *Resolver / Rechazar*.
- Listado de **Solicitudes de omitir colación** pendientes, con acciones *Aprobar / Rechazar*.
- **Alertas de marcación** (marcaciones con estado *alerta* o *pendiente*).
- Listado de **Equipo** con buscador por nombre, RUT o cargo y botón **+ Agregar trabajador**.

**Caso de uso: crear un trabajador**
1. Panel Admin → **+ Agregar**.
2. Completar: RUT, nombres, apellidos, teléfono, cargo, empresa, supervisor, rol (trabajador/supervisor/admin), estado activo.
3. Configurar el **Horario**:
   - Hora de entrada / hora de salida.
   - **Minutos de colación** (cantidad de horas/minutos, no un rango fijo).
   - Usar o no colación por defecto.
   - Tolerancia en minutos.
   - Días laborables (L–D).
4. Guardar. El trabajador queda registrado en Supabase con contraseña inicial `123456`.

**Caso de uso: editar horario de un trabajador**
1. Panel Admin → tocar al trabajador.
2. Modificar los campos deseados (horario, cargo, rol, activo/bloqueado).
3. Guardar.

**Caso de uso: aprobar/rechazar omitir colación**
1. En el Panel Admin, buscar la tarjeta de la solicitud.
2. Presionar **Aprobar** o **Rechazar**.
3. Se actualiza el estado en la app del trabajador y en Supabase.

**Caso de uso: resolver solicitud de contraseña**
1. En el Panel Admin, tocar **Resolver** en la tarjeta de la solicitud.
2. La contraseña del RUT se restablece a `123456`.
3. Alternativamente **Rechazar** cierra la solicitud sin cambios.

### 5.2 Puntos de trabajo
- Listado de puntos (obras/faenas) con dirección, geocerca (radio en metros) y estado.
- **+ Nuevo punto** para crear.

**Caso de uso: crear un punto de trabajo**
1. Admin → **Puntos de trabajo** → **+ Nuevo**.
2. Ingresar nombre, dirección (puede usar Google Places), latitud/longitud, radio permitido.
3. Guardar. El punto queda disponible para asignar a trabajadores.

### 5.3 Asistencia hoy (solo admin)
- Vista del equipo completo con el estado de asistencia de **hoy**:
  - Presentes, ausentes, atrasados, en colación, finalizados.
  - Hora de cada marcación realizada por cada trabajador.
- Refresco manual.

### 5.4 Solicitudes de vacaciones
- Listado con tabs: **Pendientes / Aprobadas / Rechazadas**.
- Cada tarjeta muestra trabajador, rango de fechas, días hábiles calculados y motivo.

**Caso de uso: aprobar/rechazar vacaciones**
1. Admin → **Solicitudes de vacaciones**.
2. Abrir la solicitud pendiente.
3. Opcional: escribir comentario.
4. **Aprobar** o **Rechazar**.
5. Se actualiza el estado tanto en la app del trabajador como en Supabase.

### 5.5 Gastos (vista admin)
- Lista de todos los gastos del equipo, filtrables por estado.
- Acciones por gasto: **Aprobar / Rechazar**, ver foto del comprobante, ver datos del comercio.

---

## 6. Reglas de negocio clave

### 6.1 Validación de marcaciones
- Cada marcación registra latitud, longitud y precisión.
- Se calcula la distancia al punto de trabajo asignado.
- Si `distancia ≤ radio_permitido_metros` → **válida**.
- Si fuera del radio → **alerta** con observación automática.
- Si no hay permiso de ubicación → **alerta**.

### 6.2 Secuencia de marcaciones
Orden forzado durante el día:
1. Entrada → 2. Salida a colación → 3. Regreso de colación → 4. Salida.

Si el trabajador tiene aprobada la omisión de colación, los pasos 2 y 3 se bloquean y no son requeridos.

### 6.3 Cálculo de horas extra
- Horas extra = (hora real de salida − hora de salida planificada) positivo.
- Si se aprueba omitir colación y el trabajador cumple el horario, los minutos de colación se **suman** como horas extra.

### 6.4 Vacaciones: anticipación mínima
- Se deben solicitar con **5 días hábiles de anticipación** contados desde hoy hasta la fecha de inicio.
- Días hábiles = lunes a viernes.
- Si no se cumple la anticipación, la app bloquea el envío y muestra el mensaje correspondiente.

### 6.5 Omitir colación
- Solo el admin autoriza.
- Afecta únicamente al día solicitado.
- Mientras está pendiente, los botones de colación siguen disponibles hasta la resolución.

---

## 7. Flujos resumidos (BPM)

```
[Trabajador] → Marcar entrada → [App valida geocerca]
   → válida ✅ → Registro OK
   → alerta ⚠ → Se guarda y se notifica al Admin

[Trabajador] → Solicitar vacaciones → [App valida 5 días hábiles]
   → OK → Supabase: estado=pendiente → [Admin] Aprueba/Rechaza → Notifica

[Trabajador] → Solicitar omitir colación → estado=pendiente
   → [Admin] Aprueba → Bloquea botones colación y cuenta como HE
   → [Admin] Rechaza → Jornada normal con colación

[Trabajador] → Registrar gasto → estado=pendiente
   → [Admin] Aprueba/Rechaza → Actualiza estado

[Trabajador] → Olvidé contraseña → Solicitud=pendiente
   → [Admin] Resuelve → Password reset a 123456
```

---

## 8. Arquitectura técnica (resumen)

- **Cliente**: Expo (React Native) con Expo Router, tabs dinámicos según rol.
- **Estado global**: `@nkzw/create-context-hook` (AuthContext, MarcacionesContext, GastosContext, VacacionesContext).
- **Backend**: Supabase (tablas: `usuarios`, `trabajadores`, `empresas`, `marcaciones`, `puntos_trabajo`, `asignaciones`, `gastos`, `solicitudes_password`, `solicitudes_omitir_colacion`, `solicitudes_vacaciones`).
- **Autenticación**: hashing SHA-256 (`utils/crypto.ts`); recuperación por código vía EmailJS (`services/emailjs.ts`) para admin/supervisor.
- **Geolocalización**: `expo-location` en nativo; Geolocation API en web.
- **Compatibilidad web**: todas las funciones principales operan en Expo Web.

---

## 9. Preguntas frecuentes

**¿Qué pasa si no tengo señal al marcar?**  
La marcación se guarda localmente y se sincroniza al recuperar conexión.

**¿Puedo editar una marcación?**  
No. Solo el admin puede revisar alertas y agregar observaciones.

**¿Puedo solicitar vacaciones para hoy?**  
No. El mínimo son 5 días hábiles de anticipación.

**¿La colación puede variar cada día?**  
Sí. La configuración define **cantidad de minutos de colación**, no un horario fijo, por lo que el trabajador puede tomarla cuando corresponda en su jornada.

**¿El admin puede marcar por un trabajador?**  
No desde esta versión. Sí puede ver alertas y registrar observaciones manuales.

---

## 10. Glosario

- **Geocerca**: perímetro circular alrededor de un punto de trabajo dentro del cual una marcación se considera válida.
- **Jornada**: conjunto de marcaciones de un día (entrada → salida).
- **Colación**: pausa de almuerzo. Medida en minutos totales en la configuración.
- **Hora extra**: tiempo trabajado por sobre la jornada planificada.
- **Solicitud**: petición formal del trabajador que requiere aprobación del admin (contraseña, omitir colación, vacaciones).
