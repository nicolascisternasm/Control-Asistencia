import React, { useMemo, useState } from 'react';
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
  CalendarDays,
  Send,
  AlertCircle,
  CheckCircle2,
  Plane,
} from 'lucide-react-native';
import { COLORS } from '@/types';
import {
  useVacaciones,
  validarSolicitudVacaciones,
  MIN_DIAS_ANTICIPACION,
} from '@/contexts/VacacionesContext';
import { formatFechaLarga, toISODate } from '@/utils/fecha';

export default function VacacionFormScreen(): React.ReactElement {
  const router = useRouter();
  const { crear } = useVacaciones();

  const hoy = useMemo(() => new Date(), []);
  const sugerida = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 10);
    return toISODate(d);
  }, [hoy]);

  const [desde, setDesde] = useState<string>(sugerida);
  const [hasta, setHasta] = useState<string>(sugerida);
  const [motivo, setMotivoState] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);

  const validacion = useMemo(
    () => validarSolicitudVacaciones(desde, hasta, hoy),
    [desde, hasta, hoy],
  );

  const onEnviar = async () => {
    if (!validacion.ok) {
      Alert.alert('Solicitud inválida', validacion.message);
      return;
    }
    setEnviando(true);
    const res = await crear(desde, hasta, motivo);
    setEnviando(false);
    if (res.ok) {
      Alert.alert('Éxito', res.message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', res.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.back}
            testID="btn-back"
          >
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Solicitar vacaciones</Text>
            <Text style={styles.subtitle}>
              Requiere {MIN_DIAS_ANTICIPACION} días hábiles de anticipación
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Plane size={20} color={COLORS.primary} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.field}>
              <View style={styles.fieldLabel}>
                <CalendarDays size={14} color={COLORS.textSecondary} />
                <Text style={styles.fieldLabelText}>Desde</Text>
              </View>
              <TextInput
                value={desde}
                onChangeText={setDesde}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-desde"
              />
              <Text style={styles.helper}>{formatFechaLarga(desde)}</Text>
            </View>

            <View style={styles.field}>
              <View style={styles.fieldLabel}>
                <CalendarDays size={14} color={COLORS.textSecondary} />
                <Text style={styles.fieldLabelText}>Hasta</Text>
              </View>
              <TextInput
                value={hasta}
                onChangeText={setHasta}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-hasta"
              />
              <Text style={styles.helper}>{formatFechaLarga(hasta)}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabelText}>Motivo (opcional)</Text>
              <TextInput
                value={motivo}
                onChangeText={setMotivoState}
                placeholder="Ej: viaje familiar"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
                testID="input-motivo"
              />
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>Días hábiles</Text>
              <Text style={styles.summaryVal}>{validacion.diasHabiles}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>Anticipación hábil</Text>
              <Text style={styles.summaryVal}>{validacion.diasAnticipacion}</Text>
            </View>
          </View>

          <View
            style={[
              styles.validationBox,
              {
                backgroundColor: validacion.ok
                  ? COLORS.successLight
                  : COLORS.dangerLight,
              },
            ]}
          >
            {validacion.ok ? (
              <CheckCircle2 size={16} color={COLORS.success} />
            ) : (
              <AlertCircle size={16} color={COLORS.danger} />
            )}
            <Text
              style={[
                styles.validationText,
                {
                  color: validacion.ok ? COLORS.success : COLORS.danger,
                },
              ]}
            >
              {validacion.message}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submit,
              (!validacion.ok || enviando) && { opacity: 0.5 },
            ]}
            onPress={onEnviar}
            disabled={!validacion.ok || enviando}
            activeOpacity={0.85}
            testID="btn-enviar-vacaciones"
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Send size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Enviar solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  field: { gap: 6 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  helper: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  summary: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRow: { flex: 1, alignItems: 'center' },
  summaryLbl: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  summaryVal: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  validationText: { flex: 1, fontSize: 13, fontWeight: '600' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
    marginTop: 16,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
