import React, { useCallback, useMemo, useState } from 'react';
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
import { useAuth, LoginError } from '@/contexts/AuthContext';
import { COLORS, MOCK_TRABAJADORES } from '@/types';
import { formatRut, validateRut } from '@/utils/rut';

const errorLabel: Record<LoginError, string> = {
  rut_invalido: 'El RUT ingresado no es válido',
  no_encontrado: 'No encontramos un trabajador con ese RUT',
  password_incorrecta: 'La contraseña es incorrecta',
  bloqueado: 'Tu cuenta está bloqueada, contacta al administrador',
};

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const { login, isSubmitting } = useAuth();
  const [rut, setRut] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const rutValido = useMemo(() => rut.length > 0 && validateRut(rut), [rut]);

  const onRutChange = useCallback((v: string) => {
    setError('');
    setRut(formatRut(v));
  }, []);

  const onSubmit = useCallback(async () => {
    setError('');
    if (!rut.trim() || !password.trim()) {
      setError('Completa RUT y contraseña');
      return;
    }
    const res = await login(rut, password);
    if (!res.ok && res.error) {
      setError(errorLabel[res.error]);
    }
  }, [rut, password, login]);

  const usarDemo = useCallback((rutDemo: string) => {
    setRut(formatRut(rutDemo));
    setPassword('123456');
    setError('');
  }, []);

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

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Cuentas demo</Text>
          <Text style={styles.demoHint}>Contraseña: 123456</Text>
          {MOCK_TRABAJADORES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.demoRow}
              onPress={() => usarDemo(t.rut)}
              activeOpacity={0.7}
            >
              <View style={styles.demoAvatar}>
                <Text style={styles.demoAvatarText}>
                  {t.nombres.charAt(0)}
                  {t.apellidos.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoName}>
                  {t.nombres} {t.apellidos}
                </Text>
                <Text style={styles.demoMeta}>
                  {t.rut} · {t.rol === 'admin' ? 'Supervisor/Admin' : t.cargo}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
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
