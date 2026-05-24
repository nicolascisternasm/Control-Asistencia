// ============================================================
// EmailJS - envío de correos transaccionales (códigos de verificación)
// ------------------------------------------------------------
// Usa la API REST de EmailJS para enviar correos desde el cliente.
// Las credenciales se inyectan vía variables EXPO_PUBLIC_*.
// El template debe definir las variables {{reset_code}}, {{to_name}}, {{name}} y {{to_email}}.
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

export interface SendCodeResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Envía un correo con el código de verificación.
 * Devuelve { ok, status, error } para poder mostrar el error real al usuario.
 */
export async function sendVerificationCode(params: SendCodeParams): Promise<SendCodeResult> {
  if (!EMAILJS_ENABLED) {
    console.log('[emailjs] deshabilitado: faltan credenciales', {
      hasService: SERVICE_ID.length > 0,
      hasTemplate: TEMPLATE_ID.length > 0,
      hasKey: PUBLIC_KEY.length > 0,
    });
    return { ok: false, error: 'Credenciales de EmailJS no configuradas' };
  }
  const body = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: PUBLIC_KEY,
    template_params: {
      reset_code: params.codigo,
      to_name: params.nombre,
      name: params.nombre,
      to_email: params.toEmail,
      email: params.toEmail,
      reply_to: params.toEmail,
    },
  };
  console.log('[emailjs] enviando a', params.toEmail, {
    service: SERVICE_ID,
    template: TEMPLATE_ID,
    keyPrefix: PUBLIC_KEY.slice(0, 4),
  });
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text().catch(() => '');
    if (!res.ok) {
      console.log('[emailjs] error status=', res.status, 'body=', txt);
      return { ok: false, status: res.status, error: txt || `HTTP ${res.status}` };
    }
    console.log('[emailjs] OK status=', res.status, 'body=', txt);
    return { ok: true, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[emailjs] excepción', msg);
    return { ok: false, error: msg };
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
