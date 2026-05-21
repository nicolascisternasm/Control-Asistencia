// Utilidades de criptografía — SHA-256 hex de UTF-8, compatible con el ERP web.
// Implementación con Web Crypto API (crypto.subtle). Funciona en el preview web.

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Verifica si un string tiene formato de hash SHA-256 (64 hex chars)
export function isHash(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

// Genera una contraseña aleatoria legible (sin caracteres ambiguos como 0/O, 1/l)
export function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    out += chars[idx];
  }
  return out;
}
