// ============================================================
// EmailJS - envío de correos transaccionales (códigos de verificación)
// ------------------------------------------------------------
// Usa la API REST de EmailJS para enviar correos desde el cliente.
// Las credenciales se inyectan vía variables EXPO_PUBLIC_*.
// El template debe definir las variables {{codigo}}, {{nombre}} y {{to_email}}.
// ============================================================

const SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID ?? '';
const TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID ?? '';
const PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY ?? '';

export const EMAILJS_ENABLED =
  SERVICE_ID.length > 0 && TEMPLATE_ID.length > 0 && PUBLIC_KEY.length > 0;

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export interface SendCodeParams {
  toEmail: string;
  nombre: string;
  codigo: string;
}

/**
 * Envía un correo con el código de verificación.
 * Devuelve true si EmailJS responde 200 OK, false en cualquier otro caso.
 */
export async function sendVerificationCode(params: SendCodeParams): Promise<boolean> {
  if (!EMAILJS_ENABLED) {
    console.log('[emailjs] deshabilitado: faltan credenciales');
    return false;
  }
  try {
    const body = {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: {
        codigo: params.codigo,
        nombre: params.nombre,
        to_email: params.toEmail,
        email: params.toEmail,
      },
    };
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.log('[emailjs] error status=', res.status, txt);
      return false;
    }
    console.log('[emailjs] correo enviado ok a', params.toEmail);
    return true;
  } catch (e) {
    console.log('[emailjs] excepción', e);
    return false;
  }
}

/**
 * Genera un código numérico aleatorio de 6 dígitos (000000-999999).
 */
export function generateVerificationCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Oculta un correo para mostrarlo de forma segura en la UI.
 * Ej: "juan.perez@empresa.cl" → "ju****ez@empresa.cl"
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at < 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  if (local.length <= 4) {
    return `${local[0] ?? ''}***${domain}`;
  }
  return `${local.slice(0, 2)}****${local.slice(-2)}${domain}`;
}
