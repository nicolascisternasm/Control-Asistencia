import { haversineMeters, formatDistancia } from '../geo';

describe('haversineMeters', () => {
  it('retorna 0 para el mismo punto', () => {
    expect(haversineMeters(-33.4089, -70.5675, -33.4089, -70.5675)).toBeCloseTo(0, 0);
  });

  it('calcula distancia conocida entre dos puntos de Santiago', () => {
    // Plaza Italia a Baquedano — aprox 300m en línea recta
    const dist = haversineMeters(-33.4372, -70.6365, -33.4381, -70.6330);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(500);
  });

  it('calcula distancia entre Santiago y Buenos Aires (~1100 km)', () => {
    const dist = haversineMeters(-33.45, -70.67, -34.61, -58.37);
    expect(dist).toBeGreaterThan(1_000_000); // > 1000 km en metros
    expect(dist).toBeLessThan(1_200_000);
  });

  it('es simétrica (A→B = B→A)', () => {
    const ab = haversineMeters(-33.4089, -70.5675, -33.5107, -70.758);
    const ba = haversineMeters(-33.5107, -70.758, -33.4089, -70.5675);
    expect(ab).toBeCloseTo(ba, 2);
  });
});

describe('formatDistancia', () => {
  it('muestra metros para distancias menores a 1000m', () => {
    expect(formatDistancia(150)).toBe('150 m');
    expect(formatDistancia(999)).toBe('999 m');
  });

  it('muestra km para distancias mayores a 1000m', () => {
    expect(formatDistancia(1500)).toBe('1.50 km');
    expect(formatDistancia(10000)).toBe('10.00 km');
  });

  it('retorna guion para valores nulos o indefinidos', () => {
    expect(formatDistancia(null)).toBe('—');
    expect(formatDistancia(undefined)).toBe('—');
  });
});
