// ============================================================
// MarcacionesContext - Flujo de marcación con geocerca
// ============================================================

import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ExpoCrypto from 'expo-crypto';

function newUuid(): string {
  try {
    const v = ExpoCrypto.randomUUID?.();
    if (typeof v === 'string' && v.length === 36) return v;
  } catch {}
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
import {
  EstadoValidacion,
  Marcacion,
  PuntoTrabajo,
  SolicitudOmitirColacion,
  TipoMarcacion,
} from '@/types';
import { repo } from '@/services/repository';
import { haversineMeters, PRECISION_MINIMA_METROS } from '@/utils/geo';
import { useAuth } from '@/contexts/AuthContext';

export interface MarcacionResult {
  ok: boolean;
  message: string;
  marcacion?: Marcacion;
}

interface PosicionDispositivo {
  latitud: number | null;
  longitud: number | null;
  precision: number | null;
  disponible: boolean;
  motivo?: string;
}

async function obtenerPosicion(): Promise<PosicionDispositivo> {
  try {
    if (Platform.OS === 'web') {
      if (
        typeof navigator === 'undefined' ||
        !('geolocation' in navigator)
      ) {
        return {
          latitud: null,
          longitud: null,
          precision: null,
          disponible: false,
          motivo: 'Geolocalización no disponible',
        };
      }
      return await new Promise<PosicionDispositivo>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitud: pos.coords.latitude,
              longitud: pos.coords.longitude,
              precision: pos.coords.accuracy ?? null,
              disponible: true,
            }),
          (err) =>
            resolve({
              latitud: null,
              longitud: null,
              precision: null,
              disponible: false,
              motivo: err.message,
            }),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      return {
        latitud: null,
        longitud: null,
        precision: null,
        disponible: false,
        motivo: 'Permiso de ubicación denegado',
      };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitud: pos.coords.latitude,
      longitud: pos.coords.longitude,
      precision: pos.coords.accuracy ?? null,
      disponible: true,
    };
  } catch (e) {
    console.log('[geo] error', e);
    return {
      latitud: null,
      longitud: null,
      precision: null,
      disponible: false,
      motivo: 'No se pudo obtener ubicación',
    };
  }
}

function proximaMarcacionEsperada(
  historial: Marcacion[],
): TipoMarcacion | null {
  const hoy = new Date().toISOString().slice(0, 10);
  const delDia = historial
    .filter((m) => m.fecha_hora_servidor.slice(0, 10) === hoy)
    .sort((a, b) =>
      a.fecha_hora_servidor.localeCompare(b.fecha_hora_servidor),
    );
  const tipos = delDia.map((m) => m.tipo_marcacion);
  if (!tipos.includes('entrada')) return 'entrada';
  if (!tipos.includes('salida_colacion')) return 'salida_colacion';
  if (!tipos.includes('regreso_colacion')) return 'regreso_colacion';
  if (!tipos.includes('salida')) return 'salida';
  return null;
}

export const [MarcacionesProvider, useMarcaciones] = createContextHook(() => {
  const { trabajador } = useAuth();
  const [marcaciones, setMarcaciones] = useState<Marcacion[]>([]);
  const [puntoAsignado, setPuntoAsignado] = useState<PuntoTrabajo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [solicitudOmitirHoy, setSolicitudOmitirHoy] = useState<SolicitudOmitirColacion | null>(null);

  const recargar = useCallback(async () => {
    if (!trabajador) {
      setMarcaciones([]);
      setPuntoAsignado(null);
      setSolicitudOmitirHoy(null);
      return;
    }
    setLoading(true);
    const hoy = new Date().toISOString().slice(0, 10);
    const [lista, punto, solOmitir] = await Promise.all([
      repo.getMarcaciones(trabajador.id),
      repo.getPuntoAsignado(trabajador.id),
      repo.getSolicitudOmitirColacionHoy(trabajador.id, hoy),
    ]);
    setMarcaciones(
      lista.sort((a, b) =>
        b.fecha_hora_servidor.localeCompare(a.fecha_hora_servidor),
      ),
    );
    setPuntoAsignado(punto);
    setSolicitudOmitirHoy(solOmitir);
    setLoading(false);
  }, [trabajador]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const colacionAprobadaOmitir = solicitudOmitirHoy?.estado === 'aprobada';

  const siguiente = useMemo<TipoMarcacion | null>(() => {
    const base = proximaMarcacionEsperada(marcaciones);
    if (colacionAprobadaOmitir) {
      if (base === 'salida_colacion' || base === 'regreso_colacion') return 'salida';
    }
    return base;
  }, [marcaciones, colacionAprobadaOmitir]);

  const solicitarOmitirColacion = useCallback(
    async (motivo: string): Promise<{ ok: boolean; message: string }> => {
      if (!trabajador) return { ok: false, message: 'Sesión no válida' };
      const hoy = new Date().toISOString().slice(0, 10);
      try {
        const nueva: SolicitudOmitirColacion = {
          id: newUuid(),
          trabajador_id: trabajador.id,
          trabajador_nombre: `${trabajador.nombres} ${trabajador.apellidos}`,
          fecha: hoy,
          motivo: motivo.trim(),
          estado: 'pendiente',
          creado_en: new Date().toISOString(),
          resuelto_en: null,
          resuelto_por: null,
        };
        await repo.addSolicitudOmitirColacion(nueva);
        await recargar();
        return { ok: true, message: 'Solicitud enviada al administrador' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo enviar';
        return { ok: false, message: msg };
      }
    },
    [trabajador, recargar],
  );

  const cancelarSolicitudOmitir = useCallback(async () => {
    if (!trabajador) return;
    const hoy = new Date().toISOString().slice(0, 10);
    await repo.cancelSolicitudOmitirColacion(trabajador.id, hoy);
    await recargar();
  }, [trabajador, recargar]);

  const marcar = useCallback(
    async (tipo: TipoMarcacion): Promise<MarcacionResult> => {
      if (!trabajador) {
        return { ok: false, message: 'Sesión no válida' };
      }
      if (colacionAprobadaOmitir && (tipo === 'salida_colacion' || tipo === 'regreso_colacion')) {
        return {
          ok: false,
          message: 'Colación omitida aprobada: no debes marcar colación hoy',
        };
      }

      // Guard duro: si ya existe una marcación de este tipo hoy, no permitir otra.
      const hoyStr = new Date().toISOString().slice(0, 10);
      const yaExiste = marcaciones.some(
        (m) =>
          m.tipo_marcacion === tipo &&
          m.fecha_hora_servidor.slice(0, 10) === hoyStr,
      );
      if (yaExiste) {
        return {
          ok: false,
          message: 'Ya marcaste esta acción hoy',
        };
      }

      const esperado = siguiente;
      if (esperado !== tipo) {
        if (esperado === null) {
          return {
            ok: false,
            message: 'Ya completaste todas las marcaciones de hoy',
          };
        }
        return {
          ok: false,
          message: 'Secuencia de jornada no válida',
        };
      }

      const pos = await obtenerPosicion();
      const ahora = new Date().toISOString();

      let distancia: number | null = null;
      let dentro = false;
      let estado: EstadoValidacion = 'valida';
      let observacion = '';

      if (!pos.disponible) {
        estado = 'pendiente_revision';
        observacion = pos.motivo ?? 'Sin ubicación';
      } else if (pos.precision !== null && pos.precision > PRECISION_MINIMA_METROS) {
        estado = 'pendiente_revision';
        observacion = `Precisión baja (${Math.round(pos.precision)}m)`;
      }

      if (
        puntoAsignado &&
        pos.latitud !== null &&
        pos.longitud !== null
      ) {
        distancia = haversineMeters(
          pos.latitud,
          pos.longitud,
          puntoAsignado.latitud,
          puntoAsignado.longitud,
        );
        dentro = distancia <= puntoAsignado.radio_permitido_metros;
        if (!dentro && estado === 'valida') {
          estado = 'alerta';
          observacion = `Fuera de zona permitida (${Math.round(distancia)}m del punto)`;
        }
      }

      const nueva: Marcacion = {
        id: newUuid(),
        trabajador_id: trabajador.id,
        tipo_marcacion: tipo,
        fecha_hora_servidor: ahora,
        fecha_hora_dispositivo: ahora,
        latitud: pos.latitud,
        longitud: pos.longitud,
        precision_metros: pos.precision,
        direccion_aprox: puntoAsignado?.direccion ?? null,
        punto_trabajo_id_detectado: dentro ? (puntoAsignado?.id ?? null) : null,
        distancia_al_punto: distancia,
        dentro_geocerca: dentro,
        estado_validacion: estado,
        observacion,
        origen: 'app',
      };

      try {
        await repo.addMarcacion(nueva);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo guardar la marcación';
        console.log('[marcaciones] save failed', msg);
        await recargar();
        return { ok: false, message: msg };
      }
      await recargar();

      let message = 'Marcación registrada correctamente';
      if (estado === 'alerta') {
        message = 'Registrada fuera de zona: será revisada';
      } else if (estado === 'pendiente_revision') {
        message = observacion || 'Registrada pendiente de revisión';
      }
      return { ok: true, message, marcacion: nueva };
    },
    [trabajador, marcaciones, puntoAsignado, recargar, siguiente, colacionAprobadaOmitir],
  );

  return {
    marcaciones,
    puntoAsignado,
    loading,
    siguiente,
    marcar,
    recargar,
    solicitudOmitirHoy,
    colacionAprobadaOmitir,
    solicitarOmitirColacion,
    cancelarSolicitudOmitir,
  };
});
