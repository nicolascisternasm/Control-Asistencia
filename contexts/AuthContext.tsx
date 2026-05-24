// ============================================================
// AuthContext - Login por RUT con sesión persistente
// ============================================================

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Trabajador } from '@/types';
import { repo } from '@/services/repository';
import { cleanRut, validateRut } from '@/utils/rut';
import { hashPassword } from '@/utils/crypto';
import {
  registrarAdministrador,
  RegistroAdminInput,
  RegistroException,
} from '@/services/usuarios';

const SESSION_KEY = 'ca.session.v1';
const SESSION_TTL_DAYS = 30;
/** Cada cuánto re-verificamos en background si el admin desactivó el acceso. */
const APP_ACTIVA_POLL_MS = 60_000;

export type KickedReason = 'app_desactivada' | 'no_trabajador' | 'bloqueado';

interface SessionPayload {
  trabajadorId: string;
  rut: string;
  loggedAt: string;
  expiresAt: string;
}

export type LoginError =
  | 'rut_invalido'
  | 'no_encontrado'
  | 'no_es_trabajador'
  | 'password_incorrecta'
  | 'bloqueado'
  | 'app_desactivada'
  | 'usar_web';

export interface LoginResult {
  ok: boolean;
  error?: LoginError;
  /** Primeros 16 chars del SHA-256(password) — diagnóstico cuando falla por contraseña. */
  hashPreview?: string;
}

export type RegistroErrorCode =
  | 'supabase_off'
  | 'rut_empresa_existe'
  | 'rut_usuario_existe'
  | 'insert_empresa'
  | 'insert_usuario'
  | 'insert_trabajador'
  | 'desconocido';

export interface RegistroResult {
  ok: boolean;
  error?: RegistroErrorCode;
  detail?: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [kickedReason, setKickedReason] = useState<KickedReason | null>(null);

  // Mantiene la id del trabajador actual en un ref para que los callbacks
  // (refreshTrabajador / updateProfile / changePassword) puedan tener
  // identidad estable y no disparen loops infinitos cuando se usan en
  // useEffect deps.
  const trabajadorRef = useRef<Trabajador | null>(null);
  useEffect(() => {
    trabajadorRef.current = trabajador;
  }, [trabajador]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const payload = JSON.parse(raw) as SessionPayload;
          const expired = payload.expiresAt && new Date(payload.expiresAt) < new Date();
          if (expired) {
            await AsyncStorage.removeItem(SESSION_KEY);
          } else {
            const t = await repo.getTrabajadorByRut(payload.rut);
            if (t && t.activo) {
              setTrabajador(t);
            } else {
              await AsyncStorage.removeItem(SESSION_KEY);
            }
          }
        }
      } catch (e) {
        console.log('[auth] restore error', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (rut: string, password: string): Promise<LoginResult> => {
      setIsSubmitting(true);
      try {
        if (!validateRut(rut)) {
          return { ok: false, error: 'rut_invalido' };
        }
        const lookup = await repo.getLoginLookup(rut);
        if (lookup.status === 'no_user') {
          return { ok: false, error: 'no_encontrado' };
        }
        if (lookup.status === 'no_trabajador') {
          return { ok: false, error: 'no_es_trabajador' };
        }
        const t = lookup.trabajador;
        if (!t.activo) return { ok: false, error: 'bloqueado' };
        if (t.app_activa === false) return { ok: false, error: 'app_desactivada' };
        // Nota: bcryptjs no es compatible con Hermes, así que la app NO valida
        // bcrypt en cliente. Si el usuario fue creado en el ERP web, le pedimos
        // que recupere la contraseña desde allí.
        const cleanPassword = password.trim();
        const method = await repo.getHashMethodByRut(rut);
        if (method === 'bcrypt') {
          return { ok: false, error: 'usar_web' };
        }
        const passwordOk = await repo.verifyPassword(rut, cleanPassword);
        if (!passwordOk) {
          let hashPreview: string | undefined;
          try {
            const h = await hashPassword(cleanPassword);
            hashPreview = h.slice(0, 16);
          } catch (e) {
            console.log('[auth] hash preview error', e);
          }
          return { ok: false, error: 'password_incorrecta', hashPreview };
        }
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
        const payload: SessionPayload = {
          trabajadorId: t.id,
          rut: cleanRut(rut),
          loggedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
        setKickedReason(null);
        setTrabajador(t);
        return { ok: true };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setTrabajador(null);
  }, []);

  const clearKickedReason = useCallback(() => {
    setKickedReason(null);
  }, []);

  /**
   * Verifica contra Supabase si el trabajador actual sigue habilitado para usar la app.
   * Si el admin desactivó `app_activa`, marcó la cuenta como inactiva o eliminó el
   * registro de trabajadores, cierra la sesión y deja `kickedReason` para que la
   * pantalla de login muestre el motivo.
   */
  const checkStillAllowed = useCallback(async (): Promise<void> => {
    const current = trabajadorRef.current;
    if (!current) return;
    try {
      const fresh = await repo.getTrabajadorById(current.id);
      let reason: KickedReason | null = null;
      if (!fresh) {
        reason = 'no_trabajador';
      } else if (fresh.activo === false) {
        reason = 'bloqueado';
      } else if (fresh.app_activa === false) {
        reason = 'app_desactivada';
      }
      if (reason) {
        await AsyncStorage.removeItem(SESSION_KEY);
        setTrabajador(null);
        setKickedReason(reason);
      } else if (fresh) {
        setTrabajador((prev) => (prev && prev.id === current.id ? fresh : prev));
      }
    } catch (e) {
      console.log('[auth] checkStillAllowed error', e);
    }
  }, []);

  // Polling + AppState: cuando hay sesión, revisamos cada 60s y al volver al
  // foreground si el admin desactivó el acceso desde el ERP.
  useEffect(() => {
    if (!trabajador) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void checkStillAllowed();
    };
    const interval = setInterval(tick, APP_ACTIVA_POLL_MS);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') tick();
    });
    // Chequeo inmediato al montar (ej: al restaurar sesión).
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [trabajador?.id, checkStillAllowed]);

  const refreshTrabajador = useCallback(async (): Promise<Trabajador | null> => {
    const current = trabajadorRef.current;
    if (!current) return null;
    const currentId = current.id;
    try {
      const fresh = await repo.getTrabajadorById(currentId);
      if (fresh) {
        setTrabajador((prev) => (prev && prev.id === currentId ? fresh : prev));
        return fresh;
      }
    } catch (e) {
      console.log('[auth] refresh error', e);
    }
    return null;
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Trabajador>): Promise<void> => {
      const current = trabajadorRef.current;
      if (!current) throw new Error('No hay sesión activa');
      const currentId = current.id;
      await repo.updateTrabajador(currentId, patch);
      const fresh = await repo.getTrabajadorById(currentId);
      setTrabajador((prev) => {
        if (!prev || prev.id !== currentId) return prev;
        return fresh ?? { ...prev, ...patch };
      });
    },
    [],
  );

  const solicitarResetPassword = useCallback(
    async (comentario?: string): Promise<boolean> => {
      const current = trabajadorRef.current;
      if (!current) throw new Error('No hay sesión activa');
      return await repo.solicitarResetPassword(current, comentario ?? '');
    },
    [],
  );

  const register = useCallback(
    async (input: RegistroAdminInput): Promise<RegistroResult> => {
      setIsSubmitting(true);
      try {
        const { trabajador: t } = await registrarAdministrador(input);
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
        const payload: SessionPayload = {
          trabajadorId: t.id,
          rut: cleanRut(t.rut),
          loggedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
        setTrabajador(t);
        return { ok: true };
      } catch (e) {
        if (e instanceof RegistroException) {
          return { ok: false, error: e.code, detail: e.detail };
        }
        console.log('[auth] register error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: 'desconocido', detail: msg };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    trabajador,
    isLoading,
    isSubmitting,
    isAuthenticated: !!trabajador,
    // Si el rol del trabajador es admin/administrador exponer flag útil para UI.
    isAdmin: trabajador?.rol === 'admin' || trabajador?.rol === 'administrador',
    login,
    logout,
    kickedReason,
    clearKickedReason,
    register,
    refreshTrabajador,
    updateProfile,
    solicitarResetPassword,
  };
});
