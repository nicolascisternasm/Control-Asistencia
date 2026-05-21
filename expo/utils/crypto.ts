// Utilidades de criptografía — SHA-256 hex de UTF-8, compatible con el ERP web.
// En web usamos Web Crypto (crypto.subtle). En React Native (Expo Go / standalone)
// usamos expo-crypto porque Hermes NO expone crypto.subtle.
// Ambos caminos producen exactamente el mismo hash hex.

import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

export async function hashPassword(password: string): Promise<string> {
  if (Platform.OS === 'web') {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Nativo (iOS/Android): expo-crypto devuelve HEX en minúsculas, igual que crypto.subtle.
  const hex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: ExpoCrypto.CryptoEncoding.HEX }
  );
  return hex;
}

// Verifica si un string tiene formato de hash SHA-256 (64 hex chars)
export function isHash(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

// Genera una contraseña aleatoria legible (sin caracteres ambiguos como 0/O, 1/l)
export function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes =
    Platform.OS === 'web'
      ? (() => {
          const a = new Uint8Array(length);
          crypto.getRandomValues(a);
          return a;
        })()
      : ExpoCrypto.getRandomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}
