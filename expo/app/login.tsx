import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  IdCard,
  MapPin,
} from 'lucide-react-native';
import { useAuth, LoginError, KickedReason } from '@/contexts/AuthContext';
import { COLORS } from '@/types';
import { formatRut, validateRut } from '@/utils/rut';

const errorLabel: Record<LoginError, string> = {
  rut_invalido: 'El RUT ingresado no es válido',
  no_encontrado:
    'No estás registrado en el sistema. Solicita a tu administrador que te registre para poder ingresar.',
  no_es_trabajador:
    'Estás registrado como usuario, pero aún no como trabajador. Contacta a tu administrador para que te registre y puedas usar esta app.',
  password_incorrecta: 'La contraseña es incorrecta',
  bloqueado:
    'Tu cuenta está inactiva. Solicita a tu administrador que la reactive.',
  app_desactivada:
    'Tu acceso a la app está desactivado. Pídele a tu administrador que active tu acceso a la app para que puedas utilizarla.',
  usar_web:
    'Tu cuenta fue creada en el sistema web. Ingresa desde allí o usa “olvidé mi contraseña” en la web para recuperarla.',
};

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const { login, isSubmitting, kickedReason, clearKickedReason } = useAuth();
  const [rut, setRut] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const kickedLabel: Record<KickedReason, string> = useMemo(
    () => ({
      app_desactivada:
        'Tu administrador desactivó tu acceso a la app. Pedíle que vuelva a activarlo para poder ingresar.',
      no_trabajador:
        'Tu registro de trabajador fue eliminado. Contacta a tu administrador para volver a tener acceso.',
      bloqueado:
        'Tu cuenta fue marcada como inactiva. Solicita a tu administrador que la reactive.',
    }),
    [],
  );

  useEffect(() => {
    if (kickedReason) setError(kickedLabel[kickedReason]);
  }, [kickedReason, kickedLabel]);

  const rutValido = useMemo(() => rut.length > 0 && validateRut(rut), [rut]);

  const onRutChange = useCallback((v: string) => {
    setError('');
    if (kickedReason) clearKickedReason();
    setRut(formatRut(v));
  }, [kickedReason, clearKickedReason]);

  const onSubmit = useCallback(async () => {
    setError('');
    if (kickedReason) clearKickedReason();
    if (!rut.trim() || !password.trim()) {
      setError('Completa RUT y contraseña');
      return;
    }
    const res = await login(rut, password);
    if (!res.ok && res.error) {
      let msg = errorLabel[res.error];
      if (res.error === 'password_incorrecta' && res.hashPreview) {
        msg += `\n\nDiagnóstico — hash generado: ${res.hashPreview}…\nCompará con el password_hash en Supabase (primeros 16 chars).`;
      }
      setError(msg);
    }
  }, [rut, password, login, kickedReason, clearKickedReason]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <MapPin size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>ControlAsistencia</Text>
          <Text style={styles.tagline}>Marcación en terreno con geolocalización</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ingresar</Text>
          <Text style={styles.cardHint}>Usa tu RUT y contraseña entregada por tu empresa</Text>

          <Text style={styles.label}>RUT</Text>
          <View style={[styles.input, error && !rutValido && styles.inputError]}>
            <IdCard size={20} color={COLORS.textMuted} />
            <TextInput
              testID="input-rut"
              value={rut}
              onChangeText={onRutChange}
              placeholder="12.345.678-9"
              placeholderTextColor={COLORS.textMuted}
              style={styles.inputText}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
            {rutValido && (
              <View style={styles.rutOk}>
                <Shield size={14} color={COLORS.success} />
              </View>
            )}
          </View>

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.input}>
            <Lock size={20} color={COLORS.textMuted} />
            <TextInput
              testID="input-password"
              value={password}
              onChangeText={(v) => {
                setError('');
                setPassword(v);
              }}
              placeholder="Tu contraseña"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPass}
              style={styles.inputText}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              onPress={() => setShowPass((v) => !v)}
              hitSlop={10}
            >
              {showPass ? (
                <EyeOff size={20} color={COLORS.textMuted} />
              ) : (
                <Eye size={20} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="btn-login"
            style={[styles.cta, isSubmitting && styles.ctaDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>Ingresar</Text>
                <ArrowRight size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/forgot')}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Olvidé mi contraseña</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 ControlAsistencia</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  brand: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  cardHint: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 8,
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
  inputError: { borderColor: COLORS.danger },
  inputText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  rutOk: {
    backgroundColor: COLORS.successLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
    marginTop: 18,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: 14 },
  forgotText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  registerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    marginTop: 4,
  },
  registerHint: { color: COLORS.textSecondary, fontSize: 14 },
  registerCta: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  demoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: 12 },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  demoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoAvatarText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  demoName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  demoMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  footer: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: 24,
    fontSize: 12,
  },
});
