import {
  parseFecha,
  esDiaHabil,
  contarDiasHabilesInclusive,
  diasHabilesDeAnticipacion,
  toISODate,
} from '../fecha';

describe('parseFecha', () => {
  it('parsea una fecha ISO válida', () => {
    const d = parseFecha('2026-05-18');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // mayo = 4 (0-based)
    expect(d!.getDate()).toBe(18);
  });

  it('retorna null para formato incorrecto', () => {
    expect(parseFecha('18/05/2026')).toBeNull();
    expect(parseFecha('')).toBeNull();
    expect(parseFecha('2026-13-01')).toBeNull();
  });

  it('retorna null para fecha inválida', () => {
    expect(parseFecha('2026-02-30')).toBeNull();
  });
});

describe('toISODate', () => {
  it('convierte una fecha a formato YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 18); // 18 mayo 2026
    expect(toISODate(d)).toBe('2026-05-18');
  });

  it('agrega ceros a meses y días de un dígito', () => {
    const d = new Date(2026, 0, 5); // 5 enero 2026
    expect(toISODate(d)).toBe('2026-01-05');
  });
});

describe('esDiaHabil', () => {
  it('lunes a viernes son días hábiles', () => {
    // 18 mayo 2026 es lunes
    const lunes = new Date(2026, 4, 18);
    expect(esDiaHabil(lunes)).toBe(true);
    expect(esDiaHabil(new Date(2026, 4, 22))).toBe(true); // viernes
  });

  it('sábado y domingo no son días hábiles', () => {
    expect(esDiaHabil(new Date(2026, 4, 23))).toBe(false); // sábado
    expect(esDiaHabil(new Date(2026, 4, 24))).toBe(false); // domingo
  });
});

describe('contarDiasHabilesInclusive', () => {
  it('cuenta correctamente una semana completa', () => {
    const lunes = new Date(2026, 4, 18);
    const viernes = new Date(2026, 4, 22);
    expect(contarDiasHabilesInclusive(lunes, viernes)).toBe(5);
  });

  it('retorna 0 si fin es antes que inicio', () => {
    const hoy = new Date(2026, 4, 18);
    const ayer = new Date(2026, 4, 17);
    expect(contarDiasHabilesInclusive(hoy, ayer)).toBe(0);
  });

  it('cuenta correctamente incluyendo un fin de semana', () => {
    // lunes 18 a lunes 25 mayo = 6 días hábiles (lun-vie + lun)
    const inicio = new Date(2026, 4, 18);
    const fin = new Date(2026, 4, 25);
    expect(contarDiasHabilesInclusive(inicio, fin)).toBe(6);
  });
});

describe('diasHabilesDeAnticipacion', () => {
  it('retorna 0 si la fecha de solicitud es mañana', () => {
    const hoy = new Date(2026, 4, 18); // lunes
    const manana = new Date(2026, 4, 19); // martes
    expect(diasHabilesDeAnticipacion(hoy, manana)).toBe(0);
  });

  it('retorna días hábiles correctos con anticipación suficiente', () => {
    const hoy = new Date(2026, 4, 18);      // lunes 18 mayo
    const inicio = new Date(2026, 4, 26);   // martes 26 mayo
    // días entre mañana (martes 19) y antevíspera (lunes 25) = 5 días hábiles
    expect(diasHabilesDeAnticipacion(hoy, inicio)).toBe(5);
  });
});
