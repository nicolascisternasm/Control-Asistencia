// ============================================================
// ControlAsistencia - Tipos y datos de ejemplo
// Modelo alineado con Supabase
// ============================================================

export type TipoMarcacion =
  | 'entrada'
  | 'salida_colacion'
  | 'regreso_colacion'
  | 'salida';

export type EstadoValidacion = 'valida' | 'pendiente_revision' | 'alerta';

/**
 * Horario semanal del trabajador. La fuente de verdad es la tabla
 * `horarios_trabajadores` (columnas por día). Los campos `hora_entrada`,
 * `hora_salida`, `dias_laborables`, `usa_colacion`, `horas_jornada` y
 * `tolerancia_minutos` se derivan al cargar para mantener compatibilidad
 * con utilitarios existentes (cálculo de horas extra, atrasos, etc.).
 */
export interface HorarioTrabajador {
  // Fuente de verdad (tabla horarios_trabajadores)
  lunes: boolean;
  martes: boolean;
  miercoles: boolean;
  jueves: boolean;
  viernes: boolean;
  sabado: boolean;
  domingo: boolean;
  lunes_entrada: string;
  lunes_salida: string;
  martes_entrada: string;
  martes_salida: string;
  miercoles_entrada: string;
  miercoles_salida: string;
  jueves_entrada: string;
  jueves_salida: string;
  viernes_entrada: string;
  viernes_salida: string;
  sabado_entrada: string;
  sabado_salida: string;
  domingo_entrada: string;
  domingo_salida: string;
  minutos_colacion: number;

  // Derivados para retrocompatibilidad con utils/horas.ts
  hora_entrada: string;
  hora_salida: string;
  usa_colacion: boolean;
  horas_jornada: number;
  tolerancia_minutos: number;
  dias_laborables: number[];
}

export const DIAS_HORARIO = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;
export type DiaHorario = (typeof DIAS_HORARIO)[number];

/** Mapea día -> número (Lunes=1 ... Domingo=0). */
export const DIA_TO_NUM: Record<DiaHorario, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 0,
};

export const HORARIO_DEFAULT: HorarioTrabajador = {
  lunes: true,
  martes: true,
  miercoles: true,
  jueves: true,
  viernes: true,
  sabado: false,
  domingo: false,
  lunes_entrada: '08:30',
  lunes_salida: '17:30',
  martes_entrada: '08:30',
  martes_salida: '17:30',
  miercoles_entrada: '08:30',
  miercoles_salida: '17:30',
  jueves_entrada: '08:30',
  jueves_salida: '17:30',
  viernes_entrada: '08:30',
  viernes_salida: '17:30',
  sabado_entrada: '08:30',
  sabado_salida: '13:00',
  domingo_entrada: '08:30',
  domingo_salida: '13:00',
  minutos_colacion: 60,
  hora_entrada: '08:30',
  hora_salida: '17:30',
  usa_colacion: true,
  horas_jornada: 8,
  tolerancia_minutos: 10,
  dias_laborables: [1, 2, 3, 4, 5],
};

/**
 * Recalcula los campos derivados a partir de los flags y horas por día.
 * Útil tras editar el horario en el formulario para mantener consistente
 * `hora_entrada`/`hora_salida`/`dias_laborables` con la fuente per-día.
 */
export function recalcHorarioDerivados(h: HorarioTrabajador): HorarioTrabajador {
  const dias_laborables = DIAS_HORARIO.filter((d) => h[d]).map((d) => DIA_TO_NUM[d]).sort();
  const primeraActiva = DIAS_HORARIO.find((d) => h[d]);
  const hora_entrada = primeraActiva ? h[`${primeraActiva}_entrada` as const] || '08:30' : h.hora_entrada;
  const hora_salida = primeraActiva ? h[`${primeraActiva}_salida` as const] || '17:30' : h.hora_salida;
  const usa_colacion = (h.minutos_colacion ?? 0) > 0;
  // Horas de jornada: estimadas a partir de la primera jornada activa
  let horas_jornada = h.horas_jornada ?? 8;
  if (primeraActiva) {
    const [eh, em] = hora_entrada.split(':').map((n) => Number(n));
    const [sh, sm] = hora_salida.split(':').map((n) => Number(n));
    const mins = (sh * 60 + (sm || 0)) - (eh * 60 + (em || 0)) - (usa_colacion ? (h.minutos_colacion ?? 0) : 0);
    if (Number.isFinite(mins) && mins > 0) horas_jornada = Math.round((mins / 60) * 100) / 100;
  }
  return {
    ...h,
    dias_laborables,
    hora_entrada,
    hora_salida,
    usa_colacion,
    horas_jornada,
  };
}

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export interface SolicitudOmitirColacion {
  id: string;
  trabajador_id: string;
  trabajador_nombre: string;
  fecha: string;
  motivo: string;
  estado: EstadoSolicitud;
  creado_en: string;
  resuelto_en: string | null;
  resuelto_por: string | null;
}

export interface PermisosTrabajador {
  puede_cotizar?: boolean;
  puede_gastos?: boolean;
  puede_vacaciones?: boolean;
  puede_marcaciones?: boolean;
  puede_oc?: boolean;
  puede_rrhh?: boolean;
  puede_finanzas?: boolean;
}

export type RolUsuario = 'trabajador' | 'supervisor' | 'admin' | 'administrador';

export interface Trabajador {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  activo: boolean;
  cargo: string;
  empresa: string;
  empresa_id?: string | null;
  supervisor_id: string | null;
  ultimo_login: string | null;
  rol: RolUsuario;
  email?: string;
  fecha_ingreso?: string | null;
  horario?: HorarioTrabajador;
  app_activa?: boolean;
  estado?: string;
  sueldo?: number | null;
  permisos?: PermisosTrabajador;
  /** FK a usuarios.id si el trabajador tiene cuenta de login. */
  usuario_id?: string | null;
  /** Timestamps gestionados por DB. */
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface EmpresaTenant {
  id: string;
  rut: string;
  razon_social: string;
  nombre_fantasia?: string;
  email_contacto: string;
  telefono?: string;
  activo: boolean;
  created_at?: string;
}

export type HashMethod = 'sha256' | 'bcrypt';

export interface Usuario {
  id: string;
  rut?: string;
  nombre: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  rol: RolUsuario;
  password_hash: string;
  hash_method: HashMethod;
  activo: boolean;
  empresa_id?: string | null;
  empresa_ids?: string[];
  ultimo_acceso?: string | null;
  reset_token?: string | null;
  reset_token_exp?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface Jornada {
  id: string;
  trabajador_id: string;
  hora_entrada: string;
  hora_salida_colacion: string;
  hora_regreso_colacion: string;
  hora_salida: string;
  tolerancia_minutos: number;
  usa_colacion: boolean;
}

export interface PuntoTrabajo {
  id: string;
  nombre_lugar: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radio_permitido_metros: number;
  activo: boolean;
}

export interface AsignacionTrabajo {
  id: string;
  trabajador_id: string;
  punto_trabajo_id: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  activo: boolean;
}

export interface Marcacion {
  id: string;
  trabajador_id: string;
  tipo_marcacion: TipoMarcacion;
  fecha_hora_servidor: string;
  fecha_hora_dispositivo: string;
  latitud: number | null;
  longitud: number | null;
  precision_metros: number | null;
  direccion_aprox: string | null;
  punto_trabajo_id_detectado: string | null;
  distancia_al_punto: number | null;
  dentro_geocerca: boolean;
  estado_validacion: EstadoValidacion;
  observacion: string;
  origen: 'app' | 'web' | 'manual';
}

export type EstadoGasto = 'pendiente' | 'aprobado' | 'rechazado';
export type CategoriaGasto =
  | 'combustible'
  | 'alimentacion'
  | 'alojamiento'
  | 'materiales'
  | 'transporte'
  | 'herramientas'
  | 'otros';

export interface Gasto {
  id: string;
  trabajador_id: string;
  trabajador_nombre: string;
  empresa_id?: string | null;
  fecha_gasto: string;
  monto: number;
  moneda: string;
  categoria: CategoriaGasto;
  comercio: string;
  rut_comercio: string | null;
  numero_documento: string | null;
  tipo_documento: 'boleta' | 'factura' | 'otro';
  descripcion: string;
  foto_url: string | null;
  estado: EstadoGasto;
  creado_en: string;
  latitud: number | null;
  longitud: number | null;
}

export const CATEGORIA_GASTO_LABEL: Record<CategoriaGasto, string> = {
  combustible: 'Combustible',
  alimentacion: 'Alimentación',
  alojamiento: 'Alojamiento',
  materiales: 'Materiales',
  transporte: 'Transporte',
  herramientas: 'Herramientas',
  otros: 'Otros',
};

export type EstadoSolicitudVacaciones = 'pendiente' | 'aprobada' | 'rechazada';

export interface SolicitudVacaciones {
  id: string;
  trabajador_id: string;
  trabajador_nombre: string;
  fecha_desde: string;
  fecha_hasta: string;
  dias_habiles: number;
  motivo: string;
  estado: EstadoSolicitudVacaciones;
  creado_en: string;
  resuelto_en: string | null;
  resuelto_por: string | null;
  comentario_admin: string | null;
}

export interface SolicitudPassword {
  id: string;
  trabajador_id: string | null;
  rut: string;
  telefono: string;
  estado: 'pendiente' | 'resuelta' | 'rechazada';
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  resuelto_por: string | null;
  comentario: string;
}

// ============================================================
// PALETA CORPORATIVA
// ============================================================
export const COLORS = {
  primary: '#1E40AF',
  primaryDark: '#1E3A8A',
  primaryLight: '#DBEAFE',
  accent: '#0EA5E9',
  success: '#059669',
  successLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
};

// ============================================================
// ETIQUETAS
// ============================================================
export const TIPO_MARCACION_LABEL: Record<TipoMarcacion, string> = {
  entrada: 'Entrada',
  salida_colacion: 'Salida a colación',
  regreso_colacion: 'Regreso de colación',
  salida: 'Salida',
};

// Los datos de ejemplo están en fixtures/mock.ts (importarlos directamente desde ahí para evitar ciclos)
