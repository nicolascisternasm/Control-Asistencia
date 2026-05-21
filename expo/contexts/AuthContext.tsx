// ============================================================
// AuthContext - Login por RUT con sesión persistente
// ============================================================

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Trabajador } from '@/types';
import { repo } from '@/services/repository';
import { cleanRut, validateRut } from '@/utils/rut';

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
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        const passwordOk = await repo.verifyPassword(rut, password);
        if (!passwordOk) {
          return { ok: false, error: 'password_incorrecta' };
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
    if (!trabajador) return null;
    const currentId = trabajador.id;
    try {
      const fresh = await repo.getTrabajadorById(currentId);
      if (fresh) {
        // Solo actualizamos si todavía hay una sesión activa con el mismo id;
        // si el usuario cerró sesión mientras el refresh estaba en vuelo, no
        // revivimos el estado.
        setTrabajador((prev) => (prev && prev.id === currentId ? fresh : prev));
        return fresh;
      }
    } catch (e) {
      console.log('[auth] refresh error', e);
    }
    return null;
  }, [trabajador]);

  const updateProfile = useCallback(
    async (patch: Partial<Trabajador>): Promise<void> => {
      if (!trabajador) throw new Error('No hay sesión activa');
      const currentId = trabajador.id;
      await repo.updateTrabajador(currentId, patch);
      const fresh = await repo.getTrabajadorById(currentId);
      setTrabajador((prev) => {
        if (!prev || prev.id !== currentId) return prev;
        return fresh ?? { ...prev, ...patch };
      });
    },
    [trabajador],
  );

  const changePassword = useCallback(
    async (newPassword: string): Promise<boolean> => {
      if (!trabajador) throw new Error('No hay sesión activa');
      const ok = await repo.resetPasswordRemote(trabajador.rut, newPassword);
      if (!ok) {
        // Fallback local si Supabase no está disponible
        await repo.setPassword(trabajador.rut, newPassword);
      }
      return ok;
    },
    [trabajador],
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
    changePassword,
  };
});
