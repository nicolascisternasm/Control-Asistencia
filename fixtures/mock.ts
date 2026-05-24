import {
  AsignacionTrabajo,
  HORARIO_DEFAULT,
  PuntoTrabajo,
  Trabajador,
} from '@/types';

export const MOCK_TRABAJADORES: Trabajador[] = [
  {
    id: 't-001',
    rut: '12.345.678-5',
    nombres: 'María Paz',
    apellidos: 'González Rojas',
    telefono: '+56 9 8765 4321',
    activo: true,
    cargo: 'Operario en Terreno',
    empresa: 'Constructora Andes',
    supervisor_id: 's-001',
    ultimo_login: null,
    rol: 'trabajador',
    horario: HORARIO_DEFAULT,
  },
  {
    id: 't-002',
    rut: '15.987.654-3',
    nombres: 'Juan Carlos',
    apellidos: 'Pérez Soto',
    telefono: '+56 9 5555 1234',
    activo: true,
    cargo: 'Técnico Eléctrico',
    empresa: 'Constructora Andes',
    supervisor_id: 's-001',
    ultimo_login: null,
    rol: 'trabajador',
    horario: HORARIO_DEFAULT,
  },
  {
    id: 's-001',
    rut: '10.111.222-5',
    nombres: 'Claudia',
    apellidos: 'Martínez',
    telefono: '+56 9 1111 2222',
    activo: true,
    cargo: 'Supervisora',
    empresa: 'Constructora Andes',
    supervisor_id: null,
    ultimo_login: null,
    rol: 'admin',
  },
];

export const MOCK_PUNTOS_TRABAJO: PuntoTrabajo[] = [
  {
    id: 'p-001',
    nombre_lugar: 'Obra Las Condes',
    direccion: 'Av. Apoquindo 4500, Las Condes',
    latitud: -33.4089,
    longitud: -70.5675,
    radio_permitido_metros: 150,
    activo: true,
  },
  {
    id: 'p-002',
    nombre_lugar: 'Faena Maipú',
    direccion: 'Camino Melipilla 1200, Maipú',
    latitud: -33.5107,
    longitud: -70.758,
    radio_permitido_metros: 200,
    activo: true,
  },
];

export const MOCK_ASIGNACIONES: AsignacionTrabajo[] = [
  {
    id: 'a-001',
    trabajador_id: 't-001',
    punto_trabajo_id: 'p-001',
    fecha_desde: '2026-01-01',
    fecha_hasta: null,
    activo: true,
  },
  {
    id: 'a-002',
    trabajador_id: 't-002',
    punto_trabajo_id: 'p-002',
    fecha_desde: '2026-01-01',
    fecha_hasta: null,
    activo: true,
  },
];
