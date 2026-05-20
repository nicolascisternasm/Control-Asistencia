import { cleanRut, formatRut, validateRut, rutsEqual } from '../rut';

describe('cleanRut', () => {
  it('elimina puntos, guiones y espacios', () => {
    expect(cleanRut('12.345.678-5')).toBe('123456785');
  });

  it('convierte k minúscula a mayúscula', () => {
    expect(cleanRut('10.111.222-k')).toBe('10111222K');
  });

  it('no modifica un RUT ya limpio', () => {
    expect(cleanRut('123456785')).toBe('123456785');
  });
});

describe('formatRut', () => {
  it('formatea un RUT limpio correctamente', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
  });

  it('acepta RUT con formato ya aplicado', () => {
    expect(formatRut('12.345.678-5')).toBe('12.345.678-5');
  });

  it('maneja dígito verificador K', () => {
    expect(formatRut('10111222K')).toBe('10.111.222-K');
  });
});

describe('validateRut', () => {
  it('valida un RUT correcto con dígito numérico', () => {
    expect(validateRut('12.345.678-5')).toBe(true);
  });

  it('valida un RUT correcto con dígito K', () => {
    expect(validateRut('10.111.222-5')).toBe(true);
  });

  it('rechaza un RUT con dígito verificador incorrecto', () => {
    expect(validateRut('12.345.678-9')).toBe(false);
  });

  it('rechaza un RUT demasiado corto', () => {
    expect(validateRut('1234-5')).toBe(false);
  });

  it('rechaza un string vacío', () => {
    expect(validateRut('')).toBe(false);
  });
});

describe('rutsEqual', () => {
  it('compara RUTs con diferente formato como iguales', () => {
    expect(rutsEqual('12.345.678-5', '123456785')).toBe(true);
  });

  it('distingue RUTs diferentes', () => {
    expect(rutsEqual('12.345.678-5', '15.987.654-3')).toBe(false);
  });

  it('ignora diferencia de case en dígito K', () => {
    expect(rutsEqual('10111222k', '10111222K')).toBe(true);
  });
});
