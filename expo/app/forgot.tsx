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
} from 'lucide-react-native';
import { COLORS } from '@/types';
import { formatRut, validateRut } from '@/utils/rut';
import { repo } from '@/services/repository';

type Resultado =
  | { tipo: 'no-existe' }
  | { tipo: 'existe'; nombre: string }
  | { tipo: 'exito' };

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const [rut, setRut] = useState<string>('');
  const [consultando, setConsultando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [nuevaPwd, setNuevaPwd] = useState<string>('');
  const [confirmarPwd, setConfirmarPwd] = useState<string>('');
  const [mostrarPwd, setMostrarPwd] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);

  const consultar = useCallback(async () => {
    if (!validateRut(rut)) {
      Alert.alert('RUT inválido', 'Revisa el RUT ingresado');
      return;
    }
    setConsultando(true);
    try {
      const trabajador = await repo.getTrabajadorByRut(rut);
      if (!trabajador) {
        setResultado({ tipo: 'no-existe' });
      } else {
        const nombre = `${trabajador.nombres} ${trabajador.apellidos}`.trim();
        setResultado({ tipo: 'existe', nombre });
      }
    } catch (e) {
      console.log('[forgot] error consultando', e);
      Alert.alert('Error', 'No pudimos validar tu RUT. Intenta nuevamente.');
    } finally {
      setConsultando(false);
    }
  }, [rut]);

  const guardarPwd = useCallback(async () => {
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
      const ok = await repo.resetPasswordRemote(rut, p1);
      if (ok) {
        setResultado({ tipo: 'exito' });
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
  }, [rut, nuevaPwd, confirmarPwd]);

  const reset = useCallback(() => {
    setResultado(null);
    setNuevaPwd('');
    setConfirmarPwd('');
  }, []);

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

          {resultado === null && (
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

          {resultado?.tipo === 'no-existe' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.dangerLight ?? '#FEE2E2' }]}>
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

          {resultado?.tipo === 'existe' && (
            <View style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: COLORS.successLight }]}>
                <CheckCircle2 size={36} color={COLORS.success} />
              </View>
              <Text style={styles.resultTitle}>RUT encontrado</Text>
              {resultado.nombre.length > 0 && (
                <Text style={[styles.resultText, styles.bold]}>{resultado.nombre}</Text>
              )}

              <View style={styles.infoBox}>
                <AlertTriangle size={20} color={COLORS.warning} />
                <Text style={styles.infoText}>
                  Define una nueva contraseña. Se actualizará tanto en esta app como en el ERP
                  (mismo sistema de credenciales).
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

              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={reset}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {resultado?.tipo === 'exito' && (
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
    backgroundColor: COLORS.warningLight ?? '#FEF3C7',
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
});
