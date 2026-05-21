import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  IdCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Lock,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  MailWarning,
  UserCog,
  Send,
} from 'lucide-react-native';
import { COLORS, Trabajador } from '@/types';
import { formatRut, validateRut } from '@/utils/rut';
import { repo } from '@/services/repository';
import {
  sendVerificationCode,
  generateVerificationCode,
  maskEmail,
  EMAILJS_ENABLED,
} from '@/services/emailjs';

type Paso =
  | { tipo: 'rut' }
  | { tipo: 'no-existe' }
  | { tipo: 'trabajador'; nombre: string } // usuario normal → contactar admin
  | { tipo: 'admin-sin-email'; nombre: string }
  | { tipo: 'admin-confirmar-email'; trabajador: Trabajador }
  | { tipo: 'admin-codigo'; trabajador: Trabajador; emailEnviado: string }
  | { tipo: 'admin-password'; trabajador: Trabajador }
  | { tipo: 'exito' };

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function esAdmin(t: Trabajador): boolean {
  return t.rol === 'admin' || t.rol === 'supervisor';
}

function esEmailValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: 'rut' });

  const [rut, setRut] = useState<string>('');
  const [consultando, setConsultando] = useState<boolean>(false);

  // Estado del código
  const codigoRef = useRef<string | null>(null);
  const codigoExpiraRef = useRef<number>(0);
  const [codigoInput, setCodigoInput] = useState<string>('');
  const [enviandoCodigo, setEnviandoCodigo] = useState<boolean>(false);
  const [verificando, setVerificando] = useState<boolean>(false);

  // Nueva contraseña
  const [nuevaPwd, setNuevaPwd] = useState<string>('');
  const [confirmarPwd, setConfirmarPwd] = useState<string>('');
  const [mostrarPwd, setMostrarPwd] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);

  const reset = useCallback(() => {
    setPaso({ tipo: 'rut' });
    setCodigoInput('');
    setNuevaPwd('');
    setConfirmarPwd('');
    codigoRef.current = null;
    codigoExpiraRef.current = 0;
  }, []);

  const consultar = useCallback(async () => {
    if (!validateRut(rut)) {
      Alert.alert('RUT inválido', 'Revisa el RUT ingresado');
      return;
    }
    setConsultando(true);
    try {
      const trabajador = await repo.getTrabajadorByRut(rut);
      if (!trabajador) {
        setPaso({ tipo: 'no-existe' });
        return;
      }
      const nombre = `${trabajador.nombres} ${trabajador.apellidos}`.trim();
      if (!esAdmin(trabajador)) {
        setPaso({ tipo: 'trabajador', nombre });
        return;
      }
      const email = (trabajador.email ?? '').trim();
      if (!email || !esEmailValido(email)) {
        setPaso({ tipo: 'admin-sin-email', nombre });
        return;
      }
      setPaso({ tipo: 'admin-confirmar-email', trabajador });
    } catch (e) {
      console.log('[forgot] error consultando', e);
      Alert.alert('Error', 'No pudimos validar tu RUT. Intenta nuevamente.');
    } finally {
      setConsultando(false);
    }
  }, [rut]);

  const enviarCodigo = useCallback(
    async (t: Trabajador) => {
      const email = (t.email ?? '').trim();
      if (!esEmailValido(email)) {
        Alert.alert('Correo inválido', 'El correo registrado no es válido. Contacta a soporte.');
        return;
      }
      if (!EMAILJS_ENABLED) {
        Alert.alert(
          'Servicio de correo no configurado',
          'Falta configurar EmailJS (variables EXPO_PUBLIC_EMAILJS_*). Contacta a soporte.',
        );
        return;
      }
      setEnviandoCodigo(true);
      try {
        const codigo = generateVerificationCode();
        codigoRef.current = codigo;
        codigoExpiraRef.current = Date.now() + CODE_TTL_MS;
        const nombre = `${t.nombres} ${t.apellidos}`.trim();
        const result = await sendVerificationCode({ toEmail: email, nombre, codigo });
        if (!result.ok) {
          codigoRef.current = null;
          codigoExpiraRef.current = 0;
          const detalle =
            result.error && result.error.length > 0
              ? `\n\nDetalle: ${result.error}`
              : '';
          const status = result.status ? ` (HTTP ${result.status})` : '';
          Alert.alert(
            `No pudimos enviar el correo${status}`,
            `Posibles causas:\n• En tu cuenta de EmailJS, activa "Allow EmailJS API for non-browser applications" (Account → Security).\n• Verifica Service ID, Template ID y Public Key.\n• El template debe usar las variables {{reset_code}}, {{to_name}}, {{name}}, {{to_email}}.${detalle}`,
          );
          return;
        }
        setCodigoInput('');
        setPaso({ tipo: 'admin-codigo', trabajador: t, emailEnviado: email });
      } finally {
        setEnviandoCodigo(false);
      }
    },
    [],
  );

  const verificarCodigo = useCallback(() => {
    const ingreso = codigoInput.trim();
    if (ingreso.length !== 6) {
      Alert.alert('Código incompleto', 'El código tiene 6 dígitos.');
      return;
    }
    if (!codigoRef.current) {
      Alert.alert('Código no encontrado', 'Vuelve a solicitar el código.');
      return;
    }
    if (Date.now() > codigoExpiraRef.current) {
      Alert.alert('Código expirado', 'El código ya no es válido. Solicita uno nuevo.');
      return;
    }
    setVerificando(true);
    if (ingreso !== codigoRef.current) {
      setVerificando(false);
      Alert.alert('Código incorrecto', 'Revisa el código ingresado.');
      return;
    }
    setVerificando(false);
    // Avanzar a definir contraseña
    if (paso.tipo === 'admin-codigo') {
      setPaso({ tipo: 'admin-password', trabajador: paso.trabajador });
    }
  }, [codigoInput, paso]);

  const guardarPwd = useCallback(async () => {
    if (paso.tipo !== 'admin-password') return;
    const p1 = nuevaPwd.trim();
    const p2 = confirmarPwd.trim();
    if (p1.length < 4) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 4 caracteres');
      return;
    }
    if (p1 !== p2) {
      Alert.alert('No coinciden', 'La confirmación no coincide con la nueva contraseña');
      return;
    }
    setGuardando(true);
    try {
      const ok = await repo.resetPasswordRemote(paso.trabajador.rut, p1);
      if (ok) {
        codigoRef.current = null;
        codigoExpiraRef.current = 0;
        setPaso({ tipo: 'exito' });
      } else {
        Alert.alert(
          'No pudimos actualizar',
          'No se logró actualizar la contraseña en el servidor. Verifica tu conexión e inténtalo de nuevo.',
        );
      }
    } catch (e) {
      console.log('[forgot] error reset', e);
      Alert.alert('Error', 'Ocurrió un problema al actualizar tu contraseña.');
    } finally {
      setGuardando(false);
    }
  }, [paso, nuevaPwd, confirmarPwd]);

  useEffect(() => {
    if (paso.tipo === 'rut') {
      setCodigoInput('');
      setNuevaPwd('');
      setConfirmarPwd('');
    }
  }, [paso.tipo]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topbar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <ArrowLeft size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Recuperar contraseña</Text>
            <View style={{ width: 40 }} />
          </View>

          {paso.tipo === 'rut' && (
            <View style={styles.card}>
              <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
              <Text style={styles.subtitle}>
                Ingresa tu RUT para verificar si estás registrado en el sistema.
              </Text>

              <Text style={styles.label}>RUT</Text>
              <View style={styles.input}>
                <IdCard size={20} color={COLORS.textMuted} />
                <TextInput
                  value={rut}
                  onChangeText={(v) => setRut(formatRut(v))}
                  placeholder="12.345.678-9"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.inputText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, consultando && styles.ctaDisabled]}
                onPress={consultar}
                disabled={consultando}
                activeOpacity={0.85}
              >
                {consultando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Search size={18} color="#FFFFFF" />
                    <Text style={styles.ctaText}>Verificar RUT</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'no-existe' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.dangerLight }]}>
                <UserX size={36} color={COLORS.danger} />
              </View>
              <Text style={styles.resultTitle}>No estás registrado</Text>
              <Text style={styles.resultText}>
                El RUT <Text style={styles.bold}>{rut}</Text> no se encuentra en la base de datos.
              </Text>
              <Text style={styles.resultText}>
                Solicita a tu administrador que te registre en el sistema desde el ERP para poder
                acceder a esta aplicación.
              </Text>
              <TouchableOpacity style={styles.cta} onPress={reset} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Intentar con otro RUT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaSecondaryText}>Volver al inicio</Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'trabajador' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.primaryLight }]}>
                <UserCog size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.resultTitle}>Contacta a tu administrador</Text>
              {paso.nombre.length > 0 && (
                <Text style={[styles.resultText, styles.bold]}>{paso.nombre}</Text>
              )}
              <Text style={styles.resultText}>
                Por seguridad, solo el administrador puede restablecer tu contraseña. Comunícate con
                él para que la actualice desde el ERP.
              </Text>
              <View style={styles.infoBox}>
                <AlertTriangle size={20} color={COLORS.warning} />
                <Text style={styles.infoText}>
                  Una vez actualizada, podrás iniciar sesión con la nueva contraseña tanto en la app
                  como en el ERP.
                </Text>
              </View>
              <TouchableOpacity style={styles.cta} onPress={reset} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Intentar con otro RUT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={() => router.replace('/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaSecondaryText}>Volver al login</Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'admin-sin-email' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.warningLight }]}>
                <MailWarning size={36} color={COLORS.warning} />
              </View>
              <Text style={styles.resultTitle}>No tienes correo registrado</Text>
              {paso.nombre.length > 0 && (
                <Text style={[styles.resultText, styles.bold]}>{paso.nombre}</Text>
              )}
              <Text style={styles.resultText}>
                Tu cuenta de administrador no tiene un correo electrónico registrado, por lo que no
                podemos enviarte el código de verificación.
              </Text>
              <Text style={styles.resultText}>
                Ingresa al ERP con otra cuenta de administrador y registra tu correo en el perfil,
                o contacta a soporte.
              </Text>
              <TouchableOpacity style={styles.cta} onPress={reset} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Intentar con otro RUT</Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'admin-confirmar-email' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.primaryLight }]}>
                <Mail size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.resultTitle}>Enviar código por correo</Text>
              <Text style={styles.resultText}>
                Vamos a enviar un código de verificación al correo registrado de tu cuenta de
                administrador:
              </Text>
              <View style={styles.emailBox}>
                <Mail size={18} color={COLORS.primary} />
                <Text style={styles.emailText}>{maskEmail(paso.trabajador.email ?? '')}</Text>
              </View>
              <Text style={[styles.resultText, { marginTop: 12 }]}>
                ¿Es este tu correo? Si no lo reconoces, contacta a soporte.
              </Text>

              <TouchableOpacity
                style={[styles.cta, enviandoCodigo && styles.ctaDisabled]}
                onPress={() => enviarCodigo(paso.trabajador)}
                disabled={enviandoCodigo}
                activeOpacity={0.85}
              >
                {enviandoCodigo ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text style={styles.ctaText}>Enviar código</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={reset} activeOpacity={0.85}>
                <Text style={styles.ctaSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'admin-codigo' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.primaryLight }]}>
                <ShieldCheck size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.resultTitle}>Ingresa el código</Text>
              <Text style={styles.resultText}>
                Enviamos un código de 6 dígitos a {maskEmail(paso.emailEnviado)}. Revisa también la
                carpeta de spam.
              </Text>

              <Text style={styles.label}>Código de verificación</Text>
              <View style={styles.input}>
                <ShieldCheck size={20} color={COLORS.textMuted} />
                <TextInput
                  value={codigoInput}
                  onChangeText={(v) => setCodigoInput(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.inputText, styles.codeInput]}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, verificando && styles.ctaDisabled]}
                onPress={verificarCodigo}
                disabled={verificando}
                activeOpacity={0.85}
              >
                {verificando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>Verificar código</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ctaSecondary, enviandoCodigo && styles.ctaDisabled]}
                onPress={() => enviarCodigo(paso.trabajador)}
                disabled={enviandoCodigo}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaSecondaryText}>
                  {enviandoCodigo ? 'Reenviando...' : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'admin-password' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.successLight }]}>
                <CheckCircle2 size={36} color={COLORS.success} />
              </View>
              <Text style={styles.resultTitle}>Define tu nueva contraseña</Text>
              <View style={styles.infoBox}>
                <AlertTriangle size={20} color={COLORS.warning} />
                <Text style={styles.infoText}>
                  Se actualizará tanto en esta app como en el ERP (mismo sistema de credenciales).
                </Text>
              </View>

              <Text style={styles.label}>Nueva contraseña</Text>
              <View style={styles.input}>
                <Lock size={20} color={COLORS.textMuted} />
                <TextInput
                  value={nuevaPwd}
                  onChangeText={setNuevaPwd}
                  placeholder="Mínimo 4 caracteres"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.inputText}
                  secureTextEntry={!mostrarPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setMostrarPwd((v) => !v)} hitSlop={10}>
                  {mostrarPwd ? (
                    <EyeOff size={20} color={COLORS.textMuted} />
                  ) : (
                    <Eye size={20} color={COLORS.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirmar contraseña</Text>
              <View style={styles.input}>
                <Lock size={20} color={COLORS.textMuted} />
                <TextInput
                  value={confirmarPwd}
                  onChangeText={setConfirmarPwd}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.inputText}
                  secureTextEntry={!mostrarPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, guardando && styles.ctaDisabled]}
                onPress={guardarPwd}
                disabled={guardando}
                activeOpacity={0.85}
              >
                {guardando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>Guardar nueva contraseña</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctaSecondary} onPress={reset} activeOpacity={0.85}>
                <Text style={styles.ctaSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {paso.tipo === 'exito' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.successLight }]}>
                <CheckCircle2 size={36} color={COLORS.success} />
              </View>
              <Text style={styles.resultTitle}>Contraseña actualizada</Text>
              <Text style={styles.resultText}>
                Listo. Ya puedes iniciar sesión con tu nueva contraseña. Recuerda que también
                funciona en el ERP.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => router.replace('/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Ir al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '700' as const },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
    marginTop: 20,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  ctaSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    marginTop: 10,
  },
  ctaSecondaryText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  bold: { fontWeight: '700', color: COLORS.text },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.warningLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  emailText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
