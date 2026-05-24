// ============================================================
// Servicio de usuarios / empresas_tenant
// ------------------------------------------------------------
// CRUD contra Supabase para las tablas `usuarios` y
// `empresas_tenant`. La validación de RUT y el hash de
// contraseñas (SHA-256) viven en sus respectivos utils.
// ============================================================

import { supabase, SUPABASE_ENABLED } from '@/services/supabase';
import { hashPassword } from '@/utils/crypto';
import { cleanRut } from '@/utils/rut';
import { EmpresaTenant, RolUsuario, Trabajador, Usuario } from '@/types';

const TBL_USUARIOS = 'usuarios';
const TBL_EMPRESAS_TENANT = 'empresas_tenant';
const TBL_TRABAJADORES = 'trabajadores';

export interface RegistroAdminInput {
  empresa: {
    rut: string;
    razon_social: string;
    nombre_fantasia?: string;
    email_contacto: string;
    telefono?: string;
  };
  admin: {
    nombres: string;
    apellidos: string;
    rut: string;
    email?: string;
    telefono?: string;
    password: string;
  };
}

export interface RegistroAdminResult {
  empresa: EmpresaTenant;
  usuario: Usuario;
  trabajador: Trabajador;
}

export type RegistroError =
  | 'supabase_off'
  | 'rut_empresa_existe'
  | 'rut_usuario_existe'
  | 'insert_empresa'
  | 'insert_usuario'
  | 'insert_trabajador';

export class RegistroException extends Error {
  code: RegistroError;
  detail?: string;
  constructor(code: RegistroError, detail?: string) {
    super(detail ?? code);
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Devuelve true si ya hay una empresa con ese RUT en empresas_tenant.
 */
async function empresaTenantExiste(rut: string): Promise<boolean> {
  if (!SUPABASE_ENABLED || !supabase) return false;
  const clean = cleanRut(rut);
  const { data, error } = await supabase
    .from(TBL_EMPRESAS_TENANT)
    .select('id, rut')
    .limit(2000);
  if (error || !data) return false;
  return (data as { rut: string | null }[]).some(
    (r) => cleanRut(String(r.rut ?? '')) === clean,
  );
}

/**
 * Devuelve true si ya hay un usuario con ese RUT (no borrado).
 */
async function usuarioRutExiste(rut: string): Promise<boolean> {
  if (!SUPABASE_ENABLED || !supabase) return false;
  const clean = cleanRut(rut);
  const { data, error } = await supabase
    .from(TBL_USUARIOS)
    .select('id, rut, deleted_at')
    .limit(2000);
  if (error || !data) return false;
  return (data as { rut: string | null; deleted_at: string | null }[]).some(
    (r) => r.deleted_at == null && cleanRut(String(r.rut ?? '')) === clean,
  );
}

/**
 * Crea la empresa, el usuario administrador y su fila de trabajador
 * en una sola operación atómica desde el cliente.
 *
 * No es transaccional a nivel de BD (Supabase no expone txs desde el
 * cliente con la anon key), pero se hacen los inserts en orden y si
 * alguno falla se lanza RegistroException con el código apropiado.
 */
export async function registrarAdministrador(
  input: RegistroAdminInput,
): Promise<RegistroAdminResult> {
  if (!SUPABASE_ENABLED || !supabase) {
    throw new RegistroException('supabase_off');
  }

  const empresaRut = cleanRut(input.empresa.rut);
  const usuarioRut = cleanRut(input.admin.rut);

  if (await empresaTenantExiste(empresaRut)) {
    throw new RegistroException('rut_empresa_existe');
  }
  if (await usuarioRutExiste(usuarioRut)) {
    throw new RegistroException('rut_usuario_existe');
  }

  // 1) Crear la empresa
  const empresaPayload = {
    rut: empresaRut,
    razon_social: input.empresa.razon_social.trim(),
    nombre_fantasia: input.empresa.nombre_fantasia?.trim() || null,
    email_contacto: input.empresa.email_contacto.trim().toLowerCase(),
    telefono: input.empresa.telefono?.trim() || null,
    activo: true,
  };
  const { data: empresaRow, error: empresaErr } = await supabase
    .from(TBL_EMPRESAS_TENANT)
    .insert(empresaPayload)
    .select('*')
    .maybeSingle();
  if (empresaErr || !empresaRow) {
    console.log('[usuarios] insert empresa error', empresaErr?.message);
    throw new RegistroException('insert_empresa', empresaErr?.message);
  }
  const empresa = empresaRow as unknown as EmpresaTenant;

  // 2) Crear el usuario administrador
  const hash = await hashPassword(input.admin.password);
  const nombreCompleto = `${input.admin.nombres} ${input.admin.apellidos}`.trim();
  const usuarioPayload = {
    rut: usuarioRut,
    nombre: nombreCompleto,
    email: input.admin.email?.trim().toLowerCase() || null,
    password_hash: hash,
    hash_method: 'sha256',
    rol: 'administrador',
    empresa_id: empresa.id,
    activo: true,
  };
  const { data: usuarioRow, error: usuarioErr } = await supabase
    .from(TBL_USUARIOS)
    .insert(usuarioPayload)
    .select('*')
    .maybeSingle();
  if (usuarioErr || !usuarioRow) {
    console.log('[usuarios] insert usuario error', usuarioErr?.message);
    // Rollback manual: borrar empresa recién creada
    await supabase.from(TBL_EMPRESAS_TENANT).delete().eq('id', empresa.id);
    throw new RegistroException('insert_usuario', usuarioErr?.message);
  }
  const usuario = usuarioRow as unknown as Usuario;

  // 3) Crear el trabajador asociado
  const trabajadorPayload = {
    rut: usuarioRut,
    nombre: nombreCompleto,
    apellidos: input.admin.apellidos.trim(),
    telefono: input.admin.telefono?.trim() || null,
    cargo: 'Administrador',
    email: input.admin.email?.trim().toLowerCase() || null,
    rol: 'administrador',
    empresa_id: empresa.id,
    usuario_id: usuario.id,
    app_activa: true,
    estado: 'activo',
  };
  const { data: trabajadorRow, error: trabajadorErr } = await supabase
    .from(TBL_TRABAJADORES)
    .insert(trabajadorPayload)
    .select('*')
    .maybeSingle();
  if (trabajadorErr || !trabajadorRow) {
    console.log('[usuarios] insert trabajador error', trabajadorErr?.message);
    // Rollback parcial: borrar usuario + empresa
    await supabase.from(TBL_USUARIOS).delete().eq('id', usuario.id);
    await supabase.from(TBL_EMPRESAS_TENANT).delete().eq('id', empresa.id);
    throw new RegistroException('insert_trabajador', trabajadorErr?.message);
  }

  const trabajador: Trabajador = {
    id: String((trabajadorRow as Record<string, unknown>).id ?? ''),
    rut: usuarioRut,
    nombres: input.admin.nombres.trim(),
    apellidos: input.admin.apellidos.trim(),
    telefono: input.admin.telefono?.trim() ?? '',
    activo: true,
    cargo: 'Administrador',
    empresa: empresa.razon_social,
    empresa_id: empresa.id,
    supervisor_id: null,
    ultimo_login: null,
    rol: 'admin',
    email: input.admin.email?.trim() ?? '',
    app_activa: true,
    estado: 'activo',
    sueldo: null,
    usuario_id: usuario.id,
  };

  return { empresa, usuario, trabajador };
}

/**
 * Crea una cuenta de login (`usuarios`) para un trabajador existente
 * y devuelve el usuario_id que debe guardarse en `trabajadores.usuario_id`.
 */
export async function crearUsuarioParaTrabajador(opts: {
  rut: string;
  nombre: string;
  email?: string;
  password: string;
  rol: RolUsuario;
  empresa_id: string;
}): Promise<Usuario> {
  if (!SUPABASE_ENABLED || !supabase) {
    throw new RegistroException('supabase_off');
  }
  const rut = cleanRut(opts.rut);
  if (await usuarioRutExiste(rut)) {
    throw new RegistroException('rut_usuario_existe');
  }
  const hash = await hashPassword(opts.password);
  const payload = {
    rut,
    nombre: opts.nombre.trim(),
    email: opts.email?.trim().toLowerCase() || null,
    password_hash: hash,
    hash_method: 'sha256',
    rol: opts.rol === 'admin' ? 'administrador' : opts.rol,
    empresa_id: opts.empresa_id,
    activo: true,
  };
  const { data, error } = await supabase
    .from(TBL_USUARIOS)
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    throw new RegistroException('insert_usuario', error?.message);
  }
  return data as unknown as Usuario;
}

/** Activa/desactiva el acceso a la app desde el panel admin. */
export async function setUsuarioActivo(usuarioId: string, activo: boolean): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  const { error } = await supabase
    .from(TBL_USUARIOS)
    .update({ activo })
    .eq('id', usuarioId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Cambia el rol en la app. */
export async function setUsuarioRol(usuarioId: string, rol: RolUsuario): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  const dbRol = rol === 'admin' ? 'administrador' : rol;
  const { error } = await supabase
    .from(TBL_USUARIOS)
    .update({ rol: dbRol })
    .eq('id', usuarioId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Resetea la contraseña a un valor específico (siempre SHA-256). */
export async function resetearPasswordUsuario(
  usuarioId: string,
  nuevaPassword: string,
): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  const hash = await hashPassword(nuevaPassword);
  const { error } = await supabase
    .from(TBL_USUARIOS)
    .update({
      password_hash: hash,
      hash_method: 'sha256',
      reset_token: null,
      reset_token_exp: null,
    })
    .eq('id', usuarioId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}
