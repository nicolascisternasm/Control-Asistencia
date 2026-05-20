// ============================================================
// Repositorio de datos
// ------------------------------------------------------------
// Abstrae el origen de datos. Hoy usa mock en memoria + AsyncStorage
// para persistencia local. Mañana reemplaza cada método por una
// llamada a Supabase sin tocar la UI.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AsignacionTrabajo,
  Marcacion,
  PuntoTrabajo,
  SolicitudPassword,
  SolicitudOmitirColacion,
  SolicitudVacaciones,
  Trabajador,
} from '@/types';
import { MOCK_ASIGNACIONES, MOCK_PUNTOS_TRABAJO, MOCK_TRABAJADORES } from '@/fixtures/mock';
import { cleanRut } from '@/utils/rut';
import { hashPassword, isHash, generateRandomPassword } from '@/utils/crypto';
import { marcacionesService } from '@/services/marcaciones';
import { vacacionesService } from '@/services/vacaciones';
import { supabase, SUPABASE_ENABLED } from '@/services/supabase';

const KEYS = {
  marcaciones: 'ca.marcaciones.v1',
  solicitudes: 'ca.solicitudes.v1',
  passwords: 'ca.passwords.v2', // v2: valores hasheados con SHA-256
  trabajadores: 'ca.trabajadores.v1',
  asignaciones: 'ca.asignaciones.v1',
  puntos: 'ca.puntos.v1',
  omitirColacion: 'ca.omitir_colacion.v1',
} as const;

// Clave legacy (v1) con contraseñas en texto plano — solo para migración
const LEGACY_PASSWORDS_KEY = 'ca.passwords.v1';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.log('[repo] read error', key, e);
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.log('[repo] write error', key, e);
  }
}

async function ensureTrabajadoresSeeded(): Promise<Trabajador[]> {
  const raw = await AsyncStorage.getItem(KEYS.trabajadores);
  if (!raw) {
    await writeJson(KEYS.trabajadores, MOCK_TRABAJADORES);
    return MOCK_TRABAJADORES;
  }
  try {
    const parsed = JSON.parse(raw) as Trabajador[];
    const hasAdmin = parsed.some((t) => t.rol === 'admin' || t.rol === 'supervisor');
    if (!hasAdmin) {
      const adminSeed = MOCK_TRABAJADORES.find((t) => t.rol === 'admin');
      if (adminSeed) {
        const exists = parsed.some((t) => cleanRut(t.rut) === cleanRut(adminSeed.rut));
        const next = exists ? parsed : [...parsed, adminSeed];
        await writeJson(KEYS.trabajadores, next);
        return next;
      }
    }
    return parsed;
  } catch {
    await writeJson(KEYS.trabajadores, MOCK_TRABAJADORES);
    return MOCK_TRABAJADORES;
  }
}

async function ensureAsignacionesSeeded(): Promise<AsignacionTrabajo[]> {
  const raw = await AsyncStorage.getItem(KEYS.asignaciones);
  if (!raw) {
    await writeJson(KEYS.asignaciones, MOCK_ASIGNACIONES);
    return MOCK_ASIGNACIONES;
  }
  try {
    return JSON.parse(raw) as AsignacionTrabajo[];
  } catch {
    await writeJson(KEYS.asignaciones, MOCK_ASIGNACIONES);
    return MOCK_ASIGNACIONES;
  }
}

async function ensurePuntosSeeded(): Promise<PuntoTrabajo[]> {
  const raw = await AsyncStorage.getItem(KEYS.puntos);
  if (!raw) {
    await writeJson(KEYS.puntos, MOCK_PUNTOS_TRABAJO);
    return MOCK_PUNTOS_TRABAJO;
  }
  try {
    return JSON.parse(raw) as PuntoTrabajo[];
  } catch {
    await writeJson(KEYS.puntos, MOCK_PUNTOS_TRABAJO);
    return MOCK_PUNTOS_TRABAJO;
  }
}

/**
 * Tabla compartida con el ERP: `usuarios` en la BD MAMKAM.
 * Mapea una fila al tipo local Trabajador. Tolerante a nombres alternativos
 * de columnas (nombre/apellido, nombres/apellidos, full_name, etc).
 */
const USUARIOS_TABLE = 'usuarios';

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v);
  }
  return '';
}

function mapSupabaseTrabajador(row: Record<string, unknown>): Trabajador {
  const nombres = pickString(row, ['nombres', 'nombre', 'first_name', 'firstName']);
  const apellidos = pickString(row, ['apellidos', 'apellido', 'last_name', 'lastName']);
  const activoRaw = row.activo ?? row.is_active ?? row.estado;
  const activo =
    typeof activoRaw === 'boolean'
      ? activoRaw
      : typeof activoRaw === 'string'
      ? !['inactivo', 'false', '0', 'no'].includes(activoRaw.toLowerCase())
      : activoRaw !== false;
  return {
    id: String(row.id ?? ''),
    rut: String(row.rut ?? ''),
    nombres,
    apellidos,
    telefono: pickString(row, ['telefono', 'phone', 'celular']),
    activo,
    cargo: pickString(row, ['cargo', 'puesto', 'role_label']),
    empresa: pickString(row, ['empresa', 'empresa_id', 'company']),
    supervisor_id: (row.supervisor_id as string | null) ?? null,
    ultimo_login: (row.ultimo_login as string | null) ?? (row.last_login as string | null) ?? null,
    rol: ((row.rol as Trabajador['rol']) ?? (row.role as Trabajador['rol']) ?? 'trabajador'),
  };
}

async function fetchTrabajadorFromSupabaseByRut(rut: string): Promise<Trabajador | null> {
  if (!SUPABASE_ENABLED || !supabase) return null;
  const target = cleanRut(rut);
  try {
    const { data, error } = await supabase
      .from(USUARIOS_TABLE)
      .select('*')
      .limit(200);
    if (error) {
      console.log('[repo] supabase usuarios error', error.message);
      return null;
    }
    if (!data) return null;
    const row = (data as Record<string, unknown>[]).find(
      (r) => cleanRut(String(r.rut ?? '')) === target,
    );
    return row ? mapSupabaseTrabajador(row) : null;
  } catch (e) {
    console.log('[repo] supabase usuarios exception', e);
    return null;
  }
}

export const repo = {
  async getTrabajadorByRut(rut: string): Promise<Trabajador | null> {
    const target = cleanRut(rut);
    // 1) Fuente de verdad: tabla trabajadores en Supabase (gestionada por el ERP)
    if (SUPABASE_ENABLED) {
      const remote = await fetchTrabajadorFromSupabaseByRut(rut);
      if (remote) return remote;
      return null;
    }
    // 2) Fallback local (modo demo sin Supabase configurado)
    const all = await ensureTrabajadoresSeeded();
    return all.find((t) => cleanRut(t.rut) === target) ?? null;
  },

  async getAllTrabajadores(): Promise<Trabajador[]> {
    return await ensureTrabajadoresSeeded();
  },

  async getTrabajadorById(id: string): Promise<Trabajador | null> {
    const all = await ensureTrabajadoresSeeded();
    return all.find((t) => t.id === id) ?? null;
  },

  async addTrabajador(t: Trabajador): Promise<void> {
    const all = await ensureTrabajadoresSeeded();
    const exists = all.find((x) => cleanRut(x.rut) === cleanRut(t.rut));
    if (exists) throw new Error('Ya existe un trabajador con ese RUT');
    all.push(t);
    await writeJson(KEYS.trabajadores, all);
  },

  async updateTrabajador(id: string, patch: Partial<Trabajador>): Promise<void> {
    const all = await ensureTrabajadoresSeeded();
    const idx = all.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error('Trabajador no encontrado');
    if (patch.rut) {
      const dup = all.find(
        (x) => x.id !== id && cleanRut(x.rut) === cleanRut(patch.rut as string),
      );
      if (dup) throw new Error('Ya existe un trabajador con ese RUT');
    }
    all[idx] = { ...all[idx], ...patch };
    await writeJson(KEYS.trabajadores, all);
  },

  async deleteTrabajador(id: string): Promise<void> {
    const all = await ensureTrabajadoresSeeded();
    const next = all.filter((x) => x.id !== id);
    await writeJson(KEYS.trabajadores, next);
  },

  async verifyPassword(rut: string, inputPassword: string): Promise<boolean> {
    const key = cleanRut(rut);

    // 1) Si Supabase está habilitado, validar contra la tabla `usuarios` (gestionada por el ERP)
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase
          .from(USUARIOS_TABLE)
          .select('rut, password_hash, password')
          .limit(500);
        if (!error && data) {
          const row = (data as Record<string, unknown>[]).find(
            (r) => cleanRut(String(r.rut ?? '')) === key,
          );
          if (row) {
            const remoteHash = (row.password_hash as string | null) ?? null;
            const remotePlain = (row.password as string | null) ?? null;
            if (remoteHash) {
              const inputHash = await hashPassword(inputPassword);
              return inputHash === remoteHash;
            }
            if (remotePlain) {
              return inputPassword === remotePlain;
            }
            // El registro existe pero no tiene contraseña en el ERP → caemos al store local.
          }
        } else if (error) {
          console.log('[repo] supabase password verify error', error.message);
        }
      } catch (e) {
        console.log('[repo] supabase password verify exception', e);
      }
    }

    const map = await readJson<Record<string, string>>(KEYS.passwords, {});
    const stored = map[key];

    if (stored) {
      // Contraseña ya hasheada (v2)
      const inputHash = await hashPassword(inputPassword);
      return inputHash === stored;
    }

    // Migración transparente: buscar en almacén legacy (texto plano)
    const legacyMap = await readJson<Record<string, string>>(LEGACY_PASSWORDS_KEY, {});
    const legacyStored = legacyMap[key] ?? '123456';
    if (inputPassword !== legacyStored) return false;

    // Migrar: guardar hash en v2 y limpiar legacy
    const hash = await hashPassword(inputPassword);
    map[key] = hash;
    await writeJson(KEYS.passwords, map);
    delete legacyMap[key];
    await writeJson(LEGACY_PASSWORDS_KEY, legacyMap);
    return true;
  },

  async setPassword(rut: string, password: string): Promise<void> {
    const map = await readJson<Record<string, string>>(KEYS.passwords, {});
    map[cleanRut(rut)] = await hashPassword(password);
    await writeJson(KEYS.passwords, map);
  },

  async getPuntosTrabajo(): Promise<PuntoTrabajo[]> {
    return await ensurePuntosSeeded();
  },

  async getPuntoTrabajoById(id: string): Promise<PuntoTrabajo | null> {
    const all = await ensurePuntosSeeded();
    return all.find((p) => p.id === id) ?? null;
  },

  async addPuntoTrabajo(p: PuntoTrabajo): Promise<void> {
    const all = await ensurePuntosSeeded();
    all.push(p);
    await writeJson(KEYS.puntos, all);
  },

  async updatePuntoTrabajo(id: string, patch: Partial<PuntoTrabajo>): Promise<void> {
    const all = await ensurePuntosSeeded();
    const idx = all.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error('Punto de trabajo no encontrado');
    all[idx] = { ...all[idx], ...patch };
    await writeJson(KEYS.puntos, all);
  },

  async deletePuntoTrabajo(id: string): Promise<void> {
    const all = await ensurePuntosSeeded();
    const asignaciones = await ensureAsignacionesSeeded();
    const enUso = asignaciones.some((a) => a.punto_trabajo_id === id && a.activo);
    if (enUso) {
      throw new Error('No se puede eliminar: hay trabajadores asignados a este punto');
    }
    const next = all.filter((x) => x.id !== id);
    await writeJson(KEYS.puntos, next);
  },

  async getPuntoAsignado(trabajadorId: string): Promise<PuntoTrabajo | null> {
    const [asignaciones, puntos] = await Promise.all([
      ensureAsignacionesSeeded(),
      ensurePuntosSeeded(),
    ]);
    const asig = asignaciones.find(
      (a) => a.trabajador_id === trabajadorId && a.activo,
    );
    if (!asig) return null;
    return puntos.find((p) => p.id === asig.punto_trabajo_id) ?? null;
  },

  async getAsignacionActiva(
    trabajadorId: string,
  ): Promise<AsignacionTrabajo | null> {
    const asignaciones = await ensureAsignacionesSeeded();
    return (
      asignaciones.find((a) => a.trabajador_id === trabajadorId && a.activo) ??
      null
    );
  },

  async setAsignacionTrabajador(
    trabajadorId: string,
    puntoTrabajoId: string | null,
  ): Promise<void> {
    const asignaciones = await ensureAsignacionesSeeded();
    const now = new Date().toISOString().slice(0, 10);
    const next = asignaciones.map((a) =>
      a.trabajador_id === trabajadorId && a.activo
        ? { ...a, activo: false, fecha_hasta: now }
        : a,
    );
    if (puntoTrabajoId) {
      next.push({
        id: `a-${Date.now()}`,
        trabajador_id: trabajadorId,
        punto_trabajo_id: puntoTrabajoId,
        fecha_desde: now,
        fecha_hasta: null,
        activo: true,
      });
    }
    await writeJson(KEYS.asignaciones, next);
  },

  async getMarcaciones(trabajadorId?: string): Promise<Marcacion[]> {
    return await marcacionesService.list(trabajadorId);
  },

  async addMarcacion(m: Marcacion): Promise<void> {
    await marcacionesService.add(m);
  },

  async getSolicitudes(): Promise<SolicitudPassword[]> {
    return await readJson<SolicitudPassword[]>(KEYS.solicitudes, []);
  },

  async restoreDemoAdmin(): Promise<{ trabajador: Trabajador; password: string }> {
    const adminSeed = MOCK_TRABAJADORES.find((t) => t.rol === 'admin');
    if (!adminSeed) throw new Error('No hay admin demo definido');
    const all = await ensureTrabajadoresSeeded();
    const idx = all.findIndex((t) => cleanRut(t.rut) === cleanRut(adminSeed.rut));
    let next: Trabajador[];
    if (idx >= 0) {
      next = [...all];
      next[idx] = { ...adminSeed };
    } else {
      next = [...all, adminSeed];
    }
    await writeJson(KEYS.trabajadores, next);
    const password = generateRandomPassword();
    await this.setPassword(adminSeed.rut, password);
    return { trabajador: adminSeed, password };
  },

  async addSolicitud(s: SolicitudPassword): Promise<void> {
    const all = await readJson<SolicitudPassword[]>(KEYS.solicitudes, []);
    all.unshift(s);
    await writeJson(KEYS.solicitudes, all);
  },

  async updateSolicitud(
    id: string,
    patch: Partial<SolicitudPassword>,
  ): Promise<void> {
    const all = await readJson<SolicitudPassword[]>(KEYS.solicitudes, []);
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      await writeJson(KEYS.solicitudes, all);
    }
  },

  async getSolicitudesOmitirColacion(): Promise<SolicitudOmitirColacion[]> {
    return await readJson<SolicitudOmitirColacion[]>(KEYS.omitirColacion, []);
  },

  async getSolicitudOmitirColacionHoy(
    trabajadorId: string,
    fecha: string,
  ): Promise<SolicitudOmitirColacion | null> {
    const all = await readJson<SolicitudOmitirColacion[]>(KEYS.omitirColacion, []);
    return (
      all.find(
        (s) => s.trabajador_id === trabajadorId && s.fecha === fecha,
      ) ?? null
    );
  },

  async addSolicitudOmitirColacion(s: SolicitudOmitirColacion): Promise<void> {
    const all = await readJson<SolicitudOmitirColacion[]>(KEYS.omitirColacion, []);
    const existe = all.find(
      (x) => x.trabajador_id === s.trabajador_id && x.fecha === s.fecha,
    );
    if (existe) throw new Error('Ya existe una solicitud para hoy');
    all.unshift(s);
    await writeJson(KEYS.omitirColacion, all);
  },

  async updateSolicitudOmitirColacion(
    id: string,
    patch: Partial<SolicitudOmitirColacion>,
  ): Promise<void> {
    const all = await readJson<SolicitudOmitirColacion[]>(KEYS.omitirColacion, []);
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      await writeJson(KEYS.omitirColacion, all);
    }
  },

  async cancelSolicitudOmitirColacion(
    trabajadorId: string,
    fecha: string,
  ): Promise<void> {
    const all = await readJson<SolicitudOmitirColacion[]>(KEYS.omitirColacion, []);
    const next = all.filter(
      (x) => !(x.trabajador_id === trabajadorId && x.fecha === fecha && x.estado === 'pendiente'),
    );
    await writeJson(KEYS.omitirColacion, next);
  },

  async getSolicitudesVacaciones(trabajadorId?: string): Promise<SolicitudVacaciones[]> {
    return await vacacionesService.list(trabajadorId);
  },

  async addSolicitudVacaciones(s: SolicitudVacaciones): Promise<void> {
    await vacacionesService.add(s);
  },

  async updateSolicitudVacaciones(
    id: string,
    patch: Partial<SolicitudVacaciones>,
  ): Promise<void> {
    await vacacionesService.update(id, patch);
  },

  async cancelSolicitudVacaciones(id: string, trabajadorId: string): Promise<void> {
    await vacacionesService.cancel(id, trabajadorId);
  },
};
