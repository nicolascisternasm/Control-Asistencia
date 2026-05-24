import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import * as ExpoCrypto from 'expo-crypto';
import { SolicitudVacaciones } from '@/types';
import { repo } from '@/services/repository';
import { useAuth } from '@/contexts/AuthContext';
import {
  contarDiasHabilesInclusive,
  diasHabilesDeAnticipacion,
  parseFecha,
} from '@/utils/fecha';

function newUuid(): string {
  try {
    const v = ExpoCrypto.randomUUID?.();
    if (typeof v === 'string' && v.length === 36) return v;
  } catch {}
  // RFC4122 v4 fallback
  const hex = '0123456789abcdef';
  const b = new Array(36);
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) b[i] = '-';
    else if (i === 14) b[i] = '4';
    else if (i === 19) b[i] = hex[(Math.random() * 4) | 0 | 8];
    else b[i] = hex[(Math.random() * 16) | 0];
  }
  return b.join('');
}

export const MIN_DIAS_ANTICIPACION = 5;

export interface ValidacionVacaciones {
  ok: boolean;
  message: string;
  diasHabiles: number;
  diasAnticipacion: number;
}

export function validarSolicitudVacaciones(
  fechaDesde: string,
  fechaHasta: string,
  hoy: Date = new Date(),
): ValidacionVacaciones {
  const desde = parseFecha(fechaDesde);
  const hasta = parseFecha(fechaHasta);
  if (!desde || !hasta) {
    return {
      ok: false,
      message: 'Fechas inválidas. Usa formato AAAA-MM-DD',
      diasHabiles: 0,
      diasAnticipacion: 0,
    };
  }
  if (hasta < desde) {
    return {
      ok: false,
      message: 'La fecha hasta no puede ser anterior a la fecha desde',
      diasHabiles: 0,
      diasAnticipacion: 0,
    };
  }
  const diasHabiles = contarDiasHabilesInclusive(desde, hasta);
  if (diasHabiles === 0) {
    return {
      ok: false,
      message: 'El rango seleccionado no tiene días hábiles',
      diasHabiles: 0,
      diasAnticipacion: 0,
    };
  }
  const diasAnticipacion = diasHabilesDeAnticipacion(hoy, desde);
  if (diasAnticipacion < MIN_DIAS_ANTICIPACION) {
    return {
      ok: false,
      message: `Se requieren ${MIN_DIAS_ANTICIPACION} días hábiles de anticipación (tienes ${diasAnticipacion})`,
      diasHabiles,
      diasAnticipacion,
    };
  }
  return { ok: true, message: 'Solicitud válida', diasHabiles, diasAnticipacion };
}

export const [VacacionesProvider, useVacaciones] = createContextHook(() => {
  const { trabajador, isAdmin } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudVacaciones[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = isAdmin
        ? await repo.getSolicitudesVacaciones()
        : trabajador
          ? await repo.getSolicitudesVacaciones(trabajador.id)
          : [];
      setSolicitudes(
        lista.sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
      );
    } finally {
      setLoading(false);
    }
  }, [trabajador, isAdmin]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (
      fechaDesde: string,
      fechaHasta: string,
      motivo: string,
    ): Promise<{ ok: boolean; message: string }> => {
      if (!trabajador) return { ok: false, message: 'Sesión no válida' };
      const val = validarSolicitudVacaciones(fechaDesde, fechaHasta);
      if (!val.ok) return { ok: false, message: val.message };
      const nueva: SolicitudVacaciones = {
        id: newUuid(),
        trabajador_id: trabajador.id,
        trabajador_nombre: `${trabajador.nombres} ${trabajador.apellidos}`,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        dias_habiles: val.diasHabiles,
        motivo: motivo.trim(),
        estado: 'pendiente',
        creado_en: new Date().toISOString(),
        resuelto_en: null,
        resuelto_por: null,
        comentario_admin: null,
      };
      try {
        await repo.addSolicitudVacaciones(nueva);
        await recargar();
        return { ok: true, message: 'Solicitud de vacaciones enviada' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear la solicitud';
        return { ok: false, message: msg };
      }
    },
    [trabajador, recargar],
  );

  const resolver = useCallback(
    async (
      id: string,
      estado: 'aprobada' | 'rechazada',
      comentario?: string,
    ) => {
      await repo.updateSolicitudVacaciones(id, {
        estado,
        resuelto_en: new Date().toISOString(),
        resuelto_por: trabajador ? `${trabajador.nombres} ${trabajador.apellidos}` : 'admin',
        comentario_admin: comentario ?? null,
      });
      await recargar();
    },
    [trabajador, recargar],
  );

  const cancelar = useCallback(
    async (id: string) => {
      if (!trabajador) return;
      await repo.cancelSolicitudVacaciones(id, trabajador.id);
      await recargar();
    },
    [trabajador, recargar],
  );

  return {
    solicitudes,
    loading,
    recargar,
    crear,
    resolver,
    cancelar,
  };
});
