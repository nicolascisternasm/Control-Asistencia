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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  IdCard,
  Mail,
  Phone,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth, RegistroErrorCode } from '@/contexts/AuthContext';
import { COLORS } from '@/types';
import { formatRut, validateRut } from '@/utils/rut';

const errorLabel: Record<RegistroErrorCode, string> = {
  supabase_off: 'No se puede conectar al servidor. Intenta más tarde.',
  rut_empresa_existe: 'Ya existe una empresa registrada con ese RUT.',
  rut_usuario_existe: 'Ya existe un usuario con ese RUT. Inicia sesión o recupera tu contraseña.',
  insert_empresa: 'No se pudo crear la empresa.',
  insert_usuario: 'No se pudo crear tu cuenta.',
  insert_trabajador: 'No se pudo completar tu perfil.',
  desconocido: 'Ocurrió un error inesperado.',
};

interface FormState {
  empresaRut: string;
  empresaRazonSocial: string;
  empresaNombreFantasia: string;
  empresaEmail: string;
  empresaTelefono: string;
  adminNombres: string;
  adminApellidos: string;
  adminRut: string;
  adminEmail: string;
  adminTelefono: string;
  password: string;
  passwordConfirm: string;
}

const INITIAL: FormState = {
  empresaRut: '',
  empresaRazonSocial: '',
  empresaNombreFantasia: '',
  empresaEmail: '',
  empresaTelefono: '',
  adminNombres: '',
  adminApellidos: '',
  adminRut: '',
  adminEmail: '',
  adminTelefono: '',
  password: '',
  passwordConfirm: '',
};

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function RegistroScreen(): React.ReactElement {
  const router = useRouter();
  const { register, isSubmitting } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [showPass, setShowPass] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const set = useCallback(
    <K extends keyof FormState>(key: K) =>
      (value: string) => {
        setError('');
        setForm((prev) => ({ ...prev, [key]: value }));
      },
    [],
  );

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.empresaRut && !validateRut(form.empresaRut)) e.empresaRut = 'RUT de empresa no válido';
    if (form.empresaRazonSocial && form.empresaRazonSocial.trim().length < 3) e.empresaRazonSocial = 'Mínimo 3 caracteres';
    if (form.empresaEmail && !isValidEmail(form.empresaEmail)) e.empresaEmail = 'Email no válido';
    if (form.adminNombres && form.adminNombres.trim().length < 2) e.adminNombres = 'Mínimo 2 caracteres';
    if (form.adminApellidos && form.adminApellidos.trim().length < 2) e.adminApellidos = 'Mínimo 2 caracteres';
    if (form.adminRut && !validateRut(form.adminRut)) e.adminRut = 'RUT no válido';
    if (form.adminEmail && !isValidEmail(form.adminEmail)) e.adminEmail = 'Email no válido';
    if (form.password && form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (form.passwordConfirm && form.password !== form.passwordConfirm) e.passwordConfirm = 'Las contraseñas no coinciden';
    return e;
  }, [form]);

  const canSubmit = useMemo(() => {
    return (
      validateRut(form.empresaRut) &&
      form.empresaRazonSocial.trim().length >= 3 &&
      isValidEmail(form.empresaEmail) &&
      form.adminNombres.trim().length >= 2 &&
      form.adminApellidos.trim().length >= 2 &&
      validateRut(form.adminRut) &&
      form.password.length >= 6 &&
      form.password === form.passwordConfirm &&
      Object.keys(errors).length === 0
    );
  }, [form, errors]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) {
      setError('Revisa los campos marcados en rojo.');
      return;
    }
    setError('');
    const res = await register({
      empresa: {
        rut: form.empresaRut,
        razon_social: form.empresaRazonSocial,
        nombre_fantasia: form.empresaNombreFantasia || undefined,
        email_contacto: form.empresaEmail,
        telefono: form.empresaTelefono || undefined,
      },
      admin: {
        nombres: form.adminNombres,
        apellidos: form.adminApellidos,
        rut: form.adminRut,
        email: form.adminEmail || undefined,
        telefono: form.adminTelefono || undefined,
        password: form.password,
      },
    });
    if (!res.ok && res.error) {
      const base = errorLabel[res.error];
      setError(res.detail ? `${base}\n\n${res.detail}` : base);
      return;
    }
    Alert.alert('Cuenta creada', 'Bienvenido a ControlAsistencia.');
  }, [canSubmit, register, form]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} testID="btn-back">
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Crear cuenta</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Building2 size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.introTitle}>Registra tu empresa</Text>
          <Text style={styles.introSubtitle}>
            Crea tu cuenta de administrador. Después podrás invitar a tu equipo desde el panel.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu empresa</Text>

          <Field
            label="RUT de la empresa"
            icon={<IdCard size={20} color={COLORS.textMuted} />}
            value={form.empresaRut}
            onChangeText={(v) => set('empresaRut')(formatRut(v))}
            placeholder="76.123.456-7"
            error={errors.empresaRut}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            valid={validateRut(form.empresaRut)}
          />
          <Field
            label="Razón social"
            icon={<Building2 size={20} color={COLORS.textMuted} />}
            value={form.empresaRazonSocial}
            onChangeText={set('empresaRazonSocial')}
            placeholder="Comercializadora ABC SpA"
            error={errors.empresaRazonSocial}
          />
          <Field
            label="Nombre de fantasía (opcional)"
            icon={<Building2 size={20} color={COLORS.textMuted} />}
            value={form.empresaNombreFantasia}
            onChangeText={set('empresaNombreFantasia')}
            placeholder="ABC"
          />
          <Field
            label="Email de contacto"
            icon={<Mail size={20} color={COLORS.textMuted} />}
            value={form.empresaEmail}
            onChangeText={set('empresaEmail')}
            placeholder="contacto@empresa.cl"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.empresaEmail}
          />
          <Field
            label="Teléfono empresa (opcional)"
            icon={<Phone size={20} color={COLORS.textMuted} />}
            value={form.empresaTelefono}
            onChangeText={set('empresaTelefono')}
            placeholder="+56 9 1234 5678"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu cuenta de administrador</Text>

          <Field
            label="Nombres"
            icon={<User size={20} color={COLORS.textMuted} />}
            value={form.adminNombres}
            onChangeText={set('adminNombres')}
            placeholder="Camila"
            error={errors.adminNombres}
          />
          <Field
            label="Apellidos"
            icon={<User size={20} color={COLORS.textMuted} />}
            value={form.adminApellidos}
            onChangeText={set('adminApellidos')}
            placeholder="Almonte Soto"
            error={errors.adminApellidos}
          />
          <Field
            label="RUT personal"
            icon={<IdCard size={20} color={COLORS.textMuted} />}
            value={form.adminRut}
            onChangeText={(v) => set('adminRut')(formatRut(v))}
            placeholder="12.345.678-9"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            error={errors.adminRut}
            valid={validateRut(form.adminRut)}
          />
          <Field
            label="Email (opcional, para recuperar contraseña)"
            icon={<Mail size={20} color={COLORS.textMuted} />}
            value={form.adminEmail}
            onChangeText={set('adminEmail')}
            placeholder="tucorreo@empresa.cl"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.adminEmail}
          />
          <Field
            label="Teléfono (opcional)"
            icon={<Phone size={20} color={COLORS.textMuted} />}
            value={form.adminTelefono}
            onChangeText={set('adminTelefono')}
            placeholder="+56 9 ..."
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.input, errors.password && styles.inputError]}>
            <Lock size={20} color={COLORS.textMuted} />
            <TextInput
              testID="input-password"
              value={form.password}
              onChangeText={set('password')}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPass}
              style={styles.inputText}
            />
            <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={10}>
              {showPass ? (
                <EyeOff size={20} color={COLORS.textMuted} />
              ) : (
                <Eye size={20} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

          <Text style={styles.label}>Confirmar contraseña</Text>
          <View style={[styles.input, errors.passwordConfirm && styles.inputError]}>
            <Lock size={20} color={COLORS.textMuted} />
            <TextInput
              testID="input-password-confirm"
              value={form.passwordConfirm}
              onChangeText={set('passwordConfirm')}
              placeholder="Repite la contraseña"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPass}
              style={styles.inputText}
            />
          </View>
          {!!errors.passwordConfirm && <Text style={styles.fieldError}>{errors.passwordConfirm}</Text>}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          testID="btn-registrar"
          style={[styles.cta, (!canSubmit || isSubmitting) && styles.ctaDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.ctaText}>Crear cuenta</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/login')}
          style={styles.loginBtn}
        >
          <Text style={styles.loginHint}>¿Ya tienes cuenta?</Text>
          <Text style={styles.loginCta}>Inicia sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  icon: React.ReactElement;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  valid?: boolean;
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  autoCapitalize,
  valid,
}: FieldProps): React.ReactElement {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, error && styles.inputError]}>
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          style={styles.inputText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={false}
        />
        {valid && (
          <View style={styles.rutOk}>
            <CheckCircle2 size={14} color={COLORS.success} />
          </View>
        )}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { padding: 20, paddingBottom: 60 },
  intro: { alignItems: 'center', paddingTop: 8, paddingBottom: 24 },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  introTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  introSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 6,
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
    height: 50,
  },
  inputError: { borderColor: COLORS.danger },
  inputText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  rutOk: {
    backgroundColor: COLORS.successLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 14,
    borderRadius: 10,
    marginVertical: 12,
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
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loginBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  loginHint: { color: COLORS.textSecondary, fontSize: 14 },
  loginCta: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
});
