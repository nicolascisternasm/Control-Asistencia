import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, IdCard, Phone, Send, CheckCircle2 } from 'lucide-react-native';
import { COLORS, SolicitudPassword } from '@/types';
import { formatRut, validateRut, cleanRut } from '@/utils/rut';
import { repo } from '@/services/repository';

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const [rut, setRut] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [enviado, setEnviado] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);

  const enviar = useCallback(async () => {
    if (!validateRut(rut)) {
      Alert.alert('RUT inválido', 'Revisa el RUT ingresado');
      return;
    }
    if (telefono.replace(/\D/g, '').length < 8) {
      Alert.alert('Teléfono inválido', 'Ingresa un teléfono de contacto');
      return;
    }
    setEnviando(true);
    const trabajador = await repo.getTrabajadorByRut(rut);
    const solicitud: SolicitudPassword = {
      id: `s-${Date.now()}`,
      trabajador_id: trabajador?.id ?? null,
      rut: cleanRut(rut),
      telefono,
      estado: 'pendiente',
      fecha_solicitud: new Date().toISOString(),
      fecha_resolucion: null,
      resuelto_por: null,
      comentario: '',
    };
    await repo.addSolicitud(solicitud);
    setEnviando(false);
    setEnviado(true);
  }, [rut, telefono]);

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

          {enviado ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <CheckCircle2 size={36} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>Solicitud enviada</Text>
              <Text style={styles.successText}>
                Un administrador revisará tu solicitud y te contactará al teléfono indicado.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Volver al inicio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
              <Text style={styles.subtitle}>
                Deja tus datos y un administrador se pondrá en contacto contigo.
                No necesitas correo electrónico.
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
                />
              </View>

              <Text style={styles.label}>Teléfono de contacto</Text>
              <View style={styles.input}>
                <Phone size={20} color={COLORS.textMuted} />
                <TextInput
                  value={telefono}
                  onChangeText={setTelefono}
                  placeholder="+56 9 ..."
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.inputText}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, enviando && styles.ctaDisabled]}
                onPress={enviar}
                disabled={enviando}
                activeOpacity={0.85}
              >
                <Send size={18} color="#FFFFFF" />
                <Text style={styles.ctaText}>
                  {enviando ? 'Enviando...' : 'Enviar solicitud'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.notice}>
                El administrador recibirá tu solicitud y gestionará un nuevo acceso.
              </Text>
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
  inputText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
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
  notice: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  successCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
