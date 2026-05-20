// Utilidades de criptografía — requiere React Native 0.73+ (Hermes con Web Crypto API)

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
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => chars[b % chars.length])
    .join('');
}
