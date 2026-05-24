export function parseFecha(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function esDiaHabil(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export function contarDiasHabilesInclusive(inicio: Date, fin: Date): number {
  if (fin < inicio) return 0;
  let count = 0;
  const cur = startOfDay(inicio);
  const end = startOfDay(fin);
  while (cur.getTime() <= end.getTime()) {
    if (esDiaHabil(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function diasHabilesDeAnticipacion(
  hoy: Date,
  fechaDesde: Date,
): number {
  const start = startOfDay(hoy);
  start.setDate(start.getDate() + 1);
  const end = startOfDay(fechaDesde);
  end.setDate(end.getDate() - 1);
  if (end < start) return 0;
  return contarDiasHabilesInclusive(start, end);
}

export function formatFechaLarga(iso: string): string {
  const d = parseFecha(iso);
  if (!d) return iso;
  return d.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
