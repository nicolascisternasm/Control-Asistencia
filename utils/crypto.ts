// SHA-256 hex de UTF-8 — compatible con el ERP web.
// Estrategia robusta multi-plataforma:
//  1) Web / React Native Web → usa crypto.subtle (Web Crypto API nativa del navegador).
//  2) Cualquier entorno donde crypto.subtle no existe (Hermes en iOS/Android) →
//     usa expo-crypto (digestStringAsync), que ya viene instalado en este proyecto.
//  3) Último recurso → implementación SHA-256 en JS puro.
// Todos producen el MISMO hex (64 chars lowercase), idéntico al ERP.

import * as ExpoCrypto from 'expo-crypto';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function utf8Encode(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  // Fallback manual UTF-8
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(++i);
      code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

// SHA-256 en JS puro (fallback) — verificado contra Node `crypto.createHash('sha256')`.
function sha256JS(message: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const bytes = utf8Encode(message);
  const l = bytes.length;
  const withOne = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  withOne.set(bytes);
  withOne[l] = 0x80;
  const bitLen = l * 8;
  // big-endian 64-bit length (only low 32 bits needed for normal inputs)
  withOne[withOne.length - 4] = (bitLen >>> 24) & 0xff;
  withOne[withOne.length - 3] = (bitLen >>> 16) & 0xff;
  withOne[withOne.length - 2] = (bitLen >>> 8) & 0xff;
  withOne[withOne.length - 1] = bitLen & 0xff;
  const W = new Uint32Array(64);
  for (let i = 0; i < withOne.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const o = i + t * 4;
      W[t] = ((withOne[o] << 24) | (withOne[o + 1] << 16) | (withOne[o + 2] << 8) | withOne[o + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let hex = '';
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0');
  return hex;
}

export async function hashPassword(password: string): Promise<string> {
  // 1) Intentar Web Crypto (preview web, navegador)
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const data = utf8Encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
      return bytesToHex(new Uint8Array(hashBuffer));
    }
  } catch (e) {
    console.log('[crypto] subtle failed, falling back', e);
  }

  // 2) Intentar expo-crypto (Hermes / dispositivo nativo)
  try {
    const hex = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      password,
      { encoding: ExpoCrypto.CryptoEncoding.HEX },
    );
    if (typeof hex === 'string' && hex.length === 64) return hex.toLowerCase();
  } catch (e) {
    console.log('[crypto] expo-crypto failed, falling back to JS', e);
  }

  // 3) JS puro
  return sha256JS(password);
}

export function isHash(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

/** Detecta si una cadena es un hash bcrypt ($2a$, $2b$, $2y$). */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

/**
 * Verifica una contraseña en texto plano contra un hash bcrypt.
 *
 * NOTA: Esta función SIEMPRE devuelve `false` en la app móvil. Los usuarios
 * gestionados por el ERP (con `hash_method='bcrypt'`) deben recuperar su
 * contraseña desde la web — la app no valida bcrypt en cliente porque la
 * librería `bcryptjs` no es compatible con Hermes (es ESM puro y depende
 * del módulo `crypto` de Node, que no existe en React Native).
 *
 * El caller debe detectar bcrypt con `isBcryptHash` y mostrar al usuario
 * el mensaje para restablecer la contraseña desde el ERP.
 */
export async function verifyBcrypt(
  _password: string,
  _hash: string,
): Promise<boolean> {
  return false;
}

export function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    out += chars[idx];
  }
  return out;
}
