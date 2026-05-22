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
 * Tabla compartida con el ERP: `trabajadores` en la BD.
 * Schema: id, empresa_id, nombre, rut, telefono, cargo, sueldo, fecha_ingreso,
 * estado, created_at, email, app_activa, puede_cotizar, puede_gastos,
 * puede_vacaciones, puede_marcaciones, puede_oc, puede_rrhh, puede_finanzas.
 */
const USUARIOS_TABLE = 'trabajadores';

/**
 * Tabla espejo (gestionada por el ERP) que guarda la contraseña del trabajador.
 * Comparte el mismo `id` que la tabla `trabajadores`, por lo que el vínculo
 * entre ambas se hace por id. Columnas relevantes: id, rut, password_hash, password.
 *
 * Esta es también la tabla que se usa para el LOGIN: buscamos al usuario por
 * RUT directamente acá, y si la fila no tiene los datos completos del
 * trabajador hacemos un join por id contra `trabajadores`.
 */
const PASSWORDS_TABLE = 'usuarios';
const LOGIN_TABLE = 'usuarios';

/** Divide "Camila Almonte Soto" -> { nombres: 'Camila', apellidos: 'Almonte Soto' }. */
function splitNombreCompleto(full: string): { nombres: string; apellidos: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombres: '', apellidos: '' };
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  return { nombres: parts[0], apellidos: parts.slice(1).join(' ') };
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v);
  }
  return '';
}

function mapSupabaseTrabajador(row: Record<string, unknown>): Trabajador {
  // Soporta tanto el schema nuevo (`nombre` único) como el legacy (`nombres`/`apellidos`).
  let nombres = pickString(row, ['nombres', 'first_name', 'firstName']);
  let apellidos = pickString(row, ['apellidos', 'apellido', 'last_name', 'lastName']);
  if (!nombres && !apellidos) {
    const full = pickString(row, ['nombre', 'nombre_completo', 'full_name']);
    const split = splitNombreCompleto(full);
    nombres = split.nombres;
    apellidos = split.apellidos;
  }

  const estadoStr = typeof row.estado === 'string' ? (row.estado as string).toLowerCase() : '';
  const appActivaRaw = row.app_activa;
  const appActiva =
    typeof appActivaRaw === 'boolean'
      ? appActivaRaw
      : typeof appActivaRaw === 'string'
      ? !['false', '0', 'no'].includes(appActivaRaw.toLowerCase())
      : appActivaRaw !== false;

  const activoLegacy = row.activo ?? row.is_active;
  const activo =
    typeof activoLegacy === 'boolean'
      ? activoLegacy
      : estadoStr
      ? !['inactivo', 'bloqueado', 'suspendido', 'false', '0', 'no'].includes(estadoStr)
      : true;

  const sueldoRaw = row.sueldo;
  const sueldo =
    typeof sueldoRaw === 'number'
      ? sueldoRaw
      : typeof sueldoRaw === 'string' && sueldoRaw.trim() !== ''
      ? Number(sueldoRaw)
      : null;

  return {
    id: String(row.id ?? ''),
    rut: String(row.rut ?? ''),
    nombres,
    apellidos,
    telefono: pickString(row, ['telefono', 'phone', 'celular']),
    activo,
    cargo: pickString(row, ['cargo', 'puesto', 'role_label']),
    empresa: pickString(row, ['empresa_id', 'empresa', 'company']),
    supervisor_id: (row.supervisor_id as string | null) ?? null,
    ultimo_login: (row.ultimo_login as string | null) ?? (row.last_login as string | null) ?? null,
    rol: 'trabajador',
    email: pickString(row, ['email', 'correo', 'mail', 'email_address']),
    fecha_ingreso:
      (row.fecha_ingreso as string | null) ??
      (row.fecha_contratacion as string | null) ??
      (row.hire_date as string | null) ??
      null,
    app_activa: appActiva,
    estado: estadoStr || (activo ? 'activo' : 'inactivo'),
    sueldo,
    permisos: {
      puede_cotizar: row.puede_cotizar === true,
      puede_gastos: row.puede_gastos === true,
      puede_vacaciones: row.puede_vacaciones === true,
      puede_marcaciones: row.puede_marcaciones === true,
      puede_oc: row.puede_oc === true,
      puede_rrhh: row.puede_rrhh === true,
      puede_finanzas: row.puede_finanzas === true,
    },
  };
}

/** Quita acentos y baja a min para comparar nombres de empresa de forma tolerante. */
function normalizeEmpresa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Construye el payload que se envía a la tabla `trabajadores` en Supabase. */
function trabajadorToRow(t: Partial<Trabajador>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.rut !== undefined) row.rut = t.rut;
  if (t.nombres !== undefined || t.apellidos !== undefined) {
    const nombre = `${t.nombres ?? ''} ${t.apellidos ?? ''}`.trim();
    if (nombre) row.nombre = nombre;
  }
  if (t.telefono !== undefined) row.telefono = t.telefono;
  if (t.cargo !== undefined) row.cargo = t.cargo;
  if (t.empresa !== undefined) row.empresa_id = t.empresa;
  if (t.email !== undefined) row.email = t.email;
  if (t.fecha_ingreso !== undefined) row.fecha_ingreso = t.fecha_ingreso;
  if (t.estado !== undefined) row.estado = t.estado;
  if (t.app_activa !== undefined) row.app_activa = t.app_activa;
  if (t.sueldo !== undefined) row.sueldo = t.sueldo;
  if (t.permisos) {
    if (t.permisos.puede_cotizar !== undefined) row.puede_cotizar = t.permisos.puede_cotizar;
    if (t.permisos.puede_gastos !== undefined) row.puede_gastos = t.permisos.puede_gastos;
    if (t.permisos.puede_vacaciones !== undefined) row.puede_vacaciones = t.permisos.puede_vacaciones;
    if (t.permisos.puede_marcaciones !== undefined) row.puede_marcaciones = t.permisos.puede_marcaciones;
    if (t.permisos.puede_oc !== undefined) row.puede_oc = t.permisos.puede_oc;
    if (t.permisos.puede_rrhh !== undefined) row.puede_rrhh = t.permisos.puede_rrhh;
    if (t.permisos.puede_finanzas !== undefined) row.puede_finanzas = t.permisos.puede_finanzas;
  }
  return row;
}

async function fetchAllTrabajadoresFromSupabase(empresa?: string): Promise<Trabajador[] | null> {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from(USUARIOS_TABLE)
      .select('*')
      .limit(2000);
    if (error || !data) {
      console.log('[repo] supabase getAllTrabajadores error', error?.message);
      return null;
    }
    const all = (data as Record<string, unknown>[]).map(mapSupabaseTrabajador);
    if (!empresa || !empresa.trim()) return all;
    const target = normalizeEmpresa(empresa);
    const filtered = all.filter((t) => normalizeEmpresa(t.empresa ?? '') === target);
    console.log('[repo] trabajadores filtrados por empresa', { empresa, total: all.length, match: filtered.length });
    return filtered;
  } catch (e) {
    console.log('[repo] supabase getAllTrabajadores exception', e);
    return null;
  }
}

/**
 * Genera variantes razonables del RUT para buscar en la BD,
 * porque el ERP podrá guardarlo con/sin puntos, con/sin guión, may/min.
 */
function rutVariants(rut: string): string[] {
  const clean = cleanRut(rut); // sin puntos ni guión, en mayúsculas
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDash = `${body}-${dv}`;
  // Formato con puntos: 12.345.678-9
  const reversed = body.split('').reverse();
  const grouped: string[] = [];
  for (let i = 0; i < reversed.length; i += 1) {
    if (i > 0 && i % 3 === 0) grouped.push('.');
    grouped.push(reversed[i]);
  }
  const dotted = `${grouped.reverse().join('')}-${dv}`;
  const set = new Set<string>([clean, withDash, dotted, clean.toLowerCase(), withDash.toLowerCase(), dotted.toLowerCase()]);
  return Array.from(set);
}

async function fetchTrabajadorFromSupabaseByRut(rut: string): Promise<Trabajador | null> {
  if (!SUPABASE_ENABLED || !supabase) {
    console.log('[repo] supabase deshabilitado, no se puede consultar login');
    return null;
  }
  const target = cleanRut(rut);
  const variants = rutVariants(rut);
  console.log('[repo] consultando login en supabase', { table: LOGIN_TABLE, rutInput: rut, target, variants });

  /** Encuentra la fila del login en la tabla `usuarios` por RUT. */
  async function findLoginRow(): Promise<Record<string, unknown> | null> {
    if (!supabase) return null;
    // 1) Intento directo por variantes de RUT
    const { data, error } = await supabase
      .from(LOGIN_TABLE)
      .select('*')
      .in('rut', variants)
      .limit(5);
    if (error) {
      console.log('[repo] supabase login .in error', error.message, error.details);
    } else if (data && data.length > 0) {
      console.log('[repo] login encontrado via .in', { count: data.length });
      return data[0] as Record<string, unknown>;
    }
    // 2) Barrido y filtro normalizado en cliente
    const { data: all, error: err2 } = await supabase
      .from(LOGIN_TABLE)
      .select('*')
      .limit(2000);
    if (err2) {
      console.log('[repo] supabase login barrido error', err2.message, err2.details);
      return null;
    }
    if (!all) return null;
    console.log('[repo] barrido login filas=', all.length);
    const row = (all as Record<string, unknown>[]).find(
      (r) => cleanRut(String(r.rut ?? '')) === target,
    );
    if (!row) {
      console.log('[repo] RUT no encontrado. Muestras:', (all as Record<string, unknown>[]).slice(0, 3).map((r) => r.rut));
      return null;
    }
    return row;
  }

  try {
    const loginRow = await findLoginRow();
    if (!loginRow) return null;

    // El `id` de la tabla `usuarios` puede NO ser un UUID (en esta BD viene
    // como `usr-<timestamp>`), pero `solicitudes_vacaciones.trabajador_id`
    // es UUID y apunta a `trabajadores.id`. Por eso buscamos la fila en
    // `trabajadores` por RUT y usamos SU id (UUID) como id del trabajador.
    let mergedRow: Record<string, unknown> = loginRow;
    let trabajadorUuid: string | null = null;
    try {
      const { data: tRows, error: tErr } = await supabase
        .from(USUARIOS_TABLE)
        .select('*')
        .in('rut', variants)
        .limit(5);
      let tRow: Record<string, unknown> | null = null;
      if (!tErr && tRows && tRows.length > 0) {
        tRow = tRows[0] as Record<string, unknown>;
      } else {
        // Barrido tolerante por si el RUT está con otro formato en `trabajadores`
        const { data: all } = await supabase
          .from(USUARIOS_TABLE)
          .select('*')
          .limit(2000);
        if (all) {
          tRow =
            (all as Record<string, unknown>[]).find(
              (r) => cleanRut(String(r.rut ?? '')) === target,
            ) ?? null;
        }
      }
      if (tRow) {
        trabajadorUuid = String(tRow.id ?? '');
        // Los datos de `trabajadores` mandan (nombre/empresa/permisos);
        // el id queda como el UUID de `trabajadores`, no el de `usuarios`.
        mergedRow = {
          ...tRow,
          id: trabajadorUuid,
          rut: tRow.rut ?? loginRow.rut,
        };
      } else if (tErr) {
        console.log('[repo] lookup trabajadores by rut error', tErr.message);
      } else {
        console.log('[repo] sin fila en trabajadores para rut', target);
      }
    } catch (e) {
      console.log('[repo] lookup trabajadores by rut exception', e);
    }
    return mapSupabaseTrabajador(mergedRow);
  } catch (e) {
    console.log('[repo] supabase login exception', e);
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

  async getAllTrabajadores(empresa?: string): Promise<Trabajador[]> {
    // Fuente de verdad: tabla `usuarios` en Supabase. Si se entrega `empresa`,
    // sólo devolvemos los usuarios que pertenecen a la misma empresa del admin.
    if (SUPABASE_ENABLED) {
      const remote = await fetchAllTrabajadoresFromSupabase(empresa);
      if (remote) {
        await writeJson(KEYS.trabajadores, remote);
        return remote;
      }
    }
    const all = await ensureTrabajadoresSeeded();
    if (!empresa || !empresa.trim()) return all;
    const target = normalizeEmpresa(empresa);
    return all.filter((t) => normalizeEmpresa(t.empresa ?? '') === target);
  },

  async getTrabajadorById(id: string): Promise<Trabajador | null> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase
          .from(USUARIOS_TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          return mapSupabaseTrabajador(data as Record<string, unknown>);
        }
      } catch (e) {
        console.log('[repo] getTrabajadorById supabase exception', e);
      }
    }
    const all = await ensureTrabajadoresSeeded();
    return all.find((t) => t.id === id) ?? null;
  },

  async addTrabajador(t: Trabajador): Promise<Trabajador> {
    if (SUPABASE_ENABLED && supabase) {
      const row = trabajadorToRow(t);
      // No mandamos `id` si la tabla lo autogenera; si viene con prefijo lo respetamos.
      if (t.id && !t.id.startsWith('t-')) row.id = t.id;
      const { data, error } = await supabase
        .from(USUARIOS_TABLE)
        .insert(row)
        .select('*')
        .maybeSingle();
      if (error) {
        throw new Error(`Supabase: ${error.message}`);
      }
      const created = data ? mapSupabaseTrabajador(data as Record<string, unknown>) : { ...t };
      return created;
    }
    const all = await ensureTrabajadoresSeeded();
    const exists = all.find((x) => cleanRut(x.rut) === cleanRut(t.rut));
    if (exists) throw new Error('Ya existe un trabajador con ese RUT');
    all.push(t);
    await writeJson(KEYS.trabajadores, all);
    return t;
  },

  async updateTrabajador(id: string, patch: Partial<Trabajador>): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      const row = trabajadorToRow(patch);
      const { error } = await supabase
        .from(USUARIOS_TABLE)
        .update(row)
        .eq('id', id);
      if (error) {
        throw new Error(`Supabase: ${error.message}`);
      }
      return;
    }
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
    if (SUPABASE_ENABLED && supabase) {
      const { error } = await supabase.from(USUARIOS_TABLE).delete().eq('id', id);
      if (error) throw new Error(`Supabase: ${error.message}`);
      return;
    }
    const all = await ensureTrabajadoresSeeded();
    const next = all.filter((x) => x.id !== id);
    await writeJson(KEYS.trabajadores, next);
  },

  async verifyPassword(rut: string, inputPassword: string): Promise<boolean> {
    const key = cleanRut(rut);

    // 1) Si Supabase está habilitado, validar contra la tabla `usuarios`
    //    (espejo gestionado por el ERP, vinculada a `trabajadores` por id).
    if (SUPABASE_ENABLED && supabase) {
      try {
        // El id de `usuarios` NO coincide con el UUID de `trabajadores` en
        // esta BD, así que buscamos directamente por RUT (variantes).
        const variants = rutVariants(rut);
        let row: Record<string, unknown> | null = null;
        const { data, error } = await supabase
          .from(PASSWORDS_TABLE)
          .select('id, rut, password_hash, password')
          .in('rut', variants)
          .limit(5);
        if (error) {
          console.log('[repo] supabase password verify .in error', error.message);
        } else if (data && data.length > 0) {
          row = data[0] as Record<string, unknown>;
        }
        if (!row) {
          // Barrido tolerante por formato de RUT
          const { data: all } = await supabase
            .from(PASSWORDS_TABLE)
            .select('id, rut, password_hash, password')
            .limit(2000);
          if (all) {
            row =
              (all as Record<string, unknown>[]).find(
                (r) => cleanRut(String(r.rut ?? '')) === key,
              ) ?? null;
          }
        }
        if (row) {
          const remoteHash = (row.password_hash as string | null) ?? null;
          const remotePlain = (row.password as string | null) ?? null;
          const inputHash = await hashPassword(inputPassword);
          console.log('[repo] verify supabase', {
            rut: key,
            hasHash: !!remoteHash,
            hasPlain: !!remotePlain,
            hashLen: remoteHash ? String(remoteHash).length : 0,
          });
          // Aceptamos múltiples formatos porque el ERP a veces guarda solo
          // `password` (texto plano) y otras veces actualiza `password_hash`.
          // Si cualquiera de los dos calza con lo ingresado, login OK.
          if (remoteHash) {
            // a) password_hash es SHA-256 hex del input
            if (inputHash === String(remoteHash).toLowerCase()) return true;
            // b) password_hash guardado en texto plano (algunos ERPs lo hacen)
            if (inputPassword === remoteHash) return true;
          }
          if (remotePlain) {
            // c) password en texto plano
            if (inputPassword === remotePlain) return true;
            // d) password contiene el hash SHA-256
            if (inputHash === String(remotePlain).toLowerCase()) return true;
          }
          if (!remoteHash && !remotePlain) {
            console.log('[repo] usuarios row sin password para rut', key);
          } else {
            console.log('[repo] password no coincide para rut', key);
            return false;
          }
        } else {
          console.log('[repo] usuarios sin fila para rut', key);
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

  /**
   * Restablece la contraseña del usuario directamente contra Supabase
   * (tabla `usuarios`, columna `password_hash`). Usa el mismo algoritmo
   * SHA-256 que el ERP, por lo que la nueva contraseña funcionará tanto
   * en la app como en el ERP.
   *
   * Devuelve true si actualizó al menos una fila.
   */
  async resetPasswordRemote(rut: string, newPassword: string): Promise<boolean> {
    const key = cleanRut(rut);
    const hash = await hashPassword(newPassword);

    if (!(SUPABASE_ENABLED && supabase)) {
      console.log('[repo] resetPasswordRemote: supabase deshabilitado');
      return false;
    }

    try {
      // En esta BD el id de `usuarios` no coincide con el UUID de
      // `trabajadores`, así que actualizamos por RUT (variantes).
      const variants = rutVariants(rut);
      const { error: updErr, data: updData } = await supabase
        .from(PASSWORDS_TABLE)
        .update({ password_hash: hash })
        .in('rut', variants)
        .select('id');
      if (updErr) {
        console.log('[repo] resetPasswordRemote update error', updErr.message);
        return false;
      }
      const updated = Array.isArray(updData) ? updData.length : 0;
      console.log('[repo] resetPasswordRemote ok filas=', updated);

      // Sincronizar también el almacén local por si Supabase queda offline
      const map = await readJson<Record<string, string>>(KEYS.passwords, {});
      map[key] = hash;
      await writeJson(KEYS.passwords, map);

      return updated > 0;
    } catch (e) {
      console.log('[repo] resetPasswordRemote exception', e);
      return false;
    }
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

  /**
   * Inserta una solicitud de reseteo de contraseña para que el admin la vea
   * desde el ERP (notificación). Persiste en la tabla `solicitudes_password`
   * en Supabase y deja una copia local como respaldo.
   */
  async solicitarResetPassword(
    trabajador: Trabajador,
    comentario: string,
  ): Promise<boolean> {
    const solicitud: SolicitudPassword = {
      id: `pwd-${Date.now()}`,
      trabajador_id: trabajador.id,
      rut: trabajador.rut,
      telefono: trabajador.telefono ?? '',
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
      fecha_resolucion: null,
      resuelto_por: null,
      comentario: comentario.trim(),
    };

    let syncedRemote = false;
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase
          .from('solicitudes_password')
          .insert(solicitud);
        if (error) {
          console.log('[repo] solicitarResetPassword insert error', error.message);
        } else {
          syncedRemote = true;
        }
      } catch (e) {
        console.log('[repo] solicitarResetPassword exception', e);
      }
    }

    const all = await readJson<SolicitudPassword[]>(KEYS.solicitudes, []);
    all.unshift(solicitud);
    await writeJson(KEYS.solicitudes, all);
    return syncedRemote;
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
