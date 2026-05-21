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

export interface HorarioTrabajador {
  hora_entrada: string;
  hora_salida: string;
  minutos_colacion: number;
  usa_colacion: boolean;
  horas_jornada: number;
  tolerancia_minutos: number;
  dias_laborables: number[];
}

export const HORARIO_DEFAULT: HorarioTrabajador = {
  hora_entrada: '08:30',
  hora_salida: '17:30',
  minutos_colacion: 60,
  usa_colacion: true,
  horas_jornada: 8,
  tolerancia_minutos: 10,
  dias_laborables: [1, 2, 3, 4, 5],
};

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

export interface Trabajador {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  activo: boolean;
  cargo: string;
  empresa: string;
  supervisor_id: string | null;
  ultimo_login: string | null;
  rol: 'trabajador' | 'supervisor' | 'admin';
  email?: string;
  fecha_ingreso?: string | null;
  horario?: HorarioTrabajador;
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
