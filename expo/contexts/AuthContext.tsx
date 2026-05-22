// ============================================================
// AuthContext - Login por RUT con sesión persistente
// ============================================================

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trabajador } from '@/types';
import { repo } from '@/services/repository';
import { cleanRut, validateRut } from '@/utils/rut';
import { hashPassword } from '@/utils/crypto';

const SESSION_KEY = 'ca.session.v1';
const SESSION_TTL_DAYS = 30;

interface SessionPayload {
  trabajadorId: string;
  rut: string;
  loggedAt: string;
  expiresAt: string;
}

export type LoginError =
  | 'rut_invalido'
  | 'no_encontrado'
  | 'password_incorrecta'
  | 'bloqueado'
  | 'app_desactivada';

export interface LoginResult {
  ok: boolean;
  error?: LoginError;
  /** Primeros 16 chars del SHA-256(password) — diagnóstico cuando falla por contraseña. */
  hashPreview?: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        const t = await repo.getTrabajadorByRut(rut);
        if (!t) return { ok: false, error: 'no_encontrado' };
        if (!t.activo) return { ok: false, error: 'bloqueado' };
        if (t.app_activa === false) return { ok: false, error: 'app_desactivada' };
        const cleanPassword = password.trim();
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

  return {
    trabajador,
    isLoading,
    isSubmitting,
    isAuthenticated: !!trabajador,
    // La app móvil ya no tiene rol admin: todos son trabajadores. Se mantiene
    // la propiedad por compatibilidad con pantallas existentes.
    isAdmin: false,
    login,
    logout,
    refreshTrabajador,
    updateProfile,
    solicitarResetPassword,
  };
});
