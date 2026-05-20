import { HorarioTrabajador, Marcacion, HORARIO_DEFAULT } from '@/types';

export interface ResumenJornada {
  fecha: string;
  entrada: Date | null;
  salida: Date | null;
  inicioColacion: Date | null;
  finColacion: Date | null;
  minutosTrabajados: number;
  minutosColacion: number;
  minutosJornadaEsperada: number;
  minutosExtra: number;
  minutosAtraso: number;
  completa: boolean;
}

function parseHHMM(hhmm: string, base: Date): Date {
  const [h, m] = hhmm.split(':').map((v) => Number(v));
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function diffMinutes(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function resumenDelDia(
  marcaciones: Marcacion[],
  fechaISO: string,
  horario: HorarioTrabajador | undefined,
): ResumenJornada {
  const h = horario ?? HORARIO_DEFAULT;
  const delDia = marcaciones
    .filter((m) => m.fecha_hora_servidor.slice(0, 10) === fechaISO)
    .sort((a, b) =>
      a.fecha_hora_servidor.localeCompare(b.fecha_hora_servidor),
    );

  const ent = delDia.find((m) => m.tipo_marcacion === 'entrada');
  const sal = delDia.find((m) => m.tipo_marcacion === 'salida');
  const salCol = delDia.find((m) => m.tipo_marcacion === 'salida_colacion');
  const regCol = delDia.find((m) => m.tipo_marcacion === 'regreso_colacion');

  const entrada = ent ? new Date(ent.fecha_hora_servidor) : null;
  const salida = sal ? new Date(sal.fecha_hora_servidor) : null;
  const inicioColacion = salCol ? new Date(salCol.fecha_hora_servidor) : null;
  const finColacion = regCol ? new Date(regCol.fecha_hora_servidor) : null;

  let minutosTrabajados = 0;
  let minutosColacion = 0;

  if (entrada && salida) {
    minutosTrabajados = diffMinutes(entrada, salida);
    if (inicioColacion && finColacion) {
      minutosColacion = diffMinutes(inicioColacion, finColacion);
      minutosTrabajados = Math.max(0, minutosTrabajados - minutosColacion);
    } else if (h.usa_colacion) {
      minutosColacion = h.minutos_colacion ?? 60;
      minutosTrabajados = Math.max(0, minutosTrabajados - minutosColacion);
    }
  }

  const minutosJornadaEsperada = Math.round((h.horas_jornada ?? 8) * 60);
  const minutosExtra = Math.max(
    0,
    minutosTrabajados - minutosJornadaEsperada,
  );

  let minutosAtraso = 0;
  if (entrada) {
    const esperado = parseHHMM(h.hora_entrada, entrada);
    const toleranciaMs = (h.tolerancia_minutos ?? 0) * 60000;
    const diff = entrada.getTime() - esperado.getTime() - toleranciaMs;
    if (diff > 0) minutosAtraso = Math.round(diff / 60000);
  }

  return {
    fecha: fechaISO,
    entrada,
    salida,
    inicioColacion,
    finColacion,
    minutosTrabajados,
    minutosColacion,
    minutosJornadaEsperada,
    minutosExtra,
    minutosAtraso,
    completa: !!entrada && !!salida,
  };
}

export function resumenMes(
  marcaciones: Marcacion[],
  year: number,
  monthZeroBased: number,
  horario: HorarioTrabajador | undefined,
): {
  dias: ResumenJornada[];
  totalTrabajado: number;
  totalExtra: number;
  totalAtraso: number;
  diasCompletos: number;
} {
  const ym = `${year}-${String(monthZeroBased + 1).padStart(2, '0')}`;
  const fechas = new Set<string>();
  for (const m of marcaciones) {
    const d = m.fecha_hora_servidor.slice(0, 10);
    if (d.startsWith(ym)) fechas.add(d);
  }
  const dias = Array.from(fechas)
    .sort()
    .map((f) => resumenDelDia(marcaciones, f, horario));
  return {
    dias,
    totalTrabajado: dias.reduce((a, d) => a + d.minutosTrabajados, 0),
    totalExtra: dias.reduce((a, d) => a + d.minutosExtra, 0),
    totalAtraso: dias.reduce((a, d) => a + d.minutosAtraso, 0),
    diasCompletos: dias.filter((d) => d.completa).length,
  };
}

export function formatMinutos(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
