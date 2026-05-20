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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  IdCard,
  User as UserIcon,
  Phone,
  Briefcase,
  Building2,
  Save,
  Trash2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react-native';
import { COLORS, HorarioTrabajador, HORARIO_DEFAULT, PuntoTrabajo, Trabajador } from '@/types';
import { Clock3, Timer } from 'lucide-react-native';
import { formatRut, validateRut, cleanRut } from '@/utils/rut';
import { repo } from '@/services/repository';
import { MapPin } from 'lucide-react-native';

type Rol = Trabajador['rol'];

const ROLES: { key: Rol; label: string }[] = [
  { key: 'trabajador', label: 'Trabajador' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'admin', label: 'Administrador' },
];

export default function TrabajadorFormScreen(): React.ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);

  const [rut, setRut] = useState<string>('');
  const [nombres, setNombres] = useState<string>('');
  const [apellidos, setApellidos] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [cargo, setCargo] = useState<string>('');
  const [empresa, setEmpresa] = useState<string>('');
  const [rol, setRol] = useState<Rol>('trabajador');
  const [activo, setActivo] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [password2, setPassword2] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [resetPass, setResetPass] = useState<boolean>(false);
  const [puntos, setPuntos] = useState<PuntoTrabajo[]>([]);
  const [puntoTrabajoId, setPuntoTrabajoId] = useState<string | null>(null);
  const [horario, setHorario] = useState<HorarioTrabajador>(HORARIO_DEFAULT);

  useEffect(() => {
    (async () => {
      const ps = await repo.getPuntosTrabajo();
      setPuntos(ps.filter((p) => p.activo));
      if (isEdit && id) {
        const t = await repo.getTrabajadorById(id as string);
        if (t) {
          setRut(t.rut);
          setNombres(t.nombres);
          setApellidos(t.apellidos);
          setTelefono(t.telefono);
          setCargo(t.cargo);
          setEmpresa(t.empresa);
          setRol(t.rol);
          setActivo(t.activo);
          setHorario(t.horario ?? HORARIO_DEFAULT);
        }
        const asig = await repo.getAsignacionActiva(id as string);
        setPuntoTrabajoId(asig?.punto_trabajo_id ?? null);
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const title = useMemo(() => (isEdit ? 'Editar trabajador' : 'Nuevo trabajador'), [isEdit]);

  const guardar = useCallback(async () => {
    if (!validateRut(rut)) {
      Alert.alert('RUT inválido', 'Revisa el RUT ingresado');
      return;
    }
    if (nombres.trim().length < 2 || apellidos.trim().length < 2) {
      Alert.alert('Datos incompletos', 'Ingresa nombres y apellidos');
      return;
    }
    if (telefono.replace(/\D/g, '').length < 8) {
      Alert.alert('Teléfono inválido', 'Ingresa un teléfono de contacto');
      return;
    }
    if (cargo.trim().length < 2) {
      Alert.alert('Cargo requerido', 'Indica el cargo del trabajador');
      return;
    }
    const willSetPassword = !isEdit || resetPass;
    if (willSetPassword) {
      if (password.length < 4) {
        Alert.alert('Contraseña muy corta', 'La contraseña debe tener al menos 4 caracteres');
        return;
      }
      if (password !== password2) {
        Alert.alert('Las contraseñas no coinciden', 'Revisa la confirmación');
        return;
      }
    }
    setSaving(true);
    try {
      let trabajadorId: string;
      if (isEdit) {
        await repo.updateTrabajador(id as string, {
          rut: formatRut(rut),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim(),
          cargo: cargo.trim(),
          empresa: empresa.trim() || 'Sin empresa',
          rol,
          activo,
          horario,
        });
        if (resetPass) {
          await repo.setPassword(cleanRut(rut), password);
        }
        trabajadorId = id as string;
      } else {
        trabajadorId = `t-${Date.now()}`;
        const nuevo: Trabajador = {
          id: trabajadorId,
          rut: formatRut(rut),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim(),
          activo,
          cargo: cargo.trim(),
          empresa: empresa.trim() || 'Sin empresa',
          supervisor_id: null,
          ultimo_login: null,
          rol,
          horario,
        };
        await repo.addTrabajador(nuevo);
        await repo.setPassword(cleanRut(rut), password);
      }
      await repo.setAsignacionTrabajador(trabajadorId, puntoTrabajoId);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [isEdit, id, rut, nombres, apellidos, telefono, cargo, empresa, rol, activo, router, password, password2, resetPass, puntoTrabajoId, horario]);

  const eliminar = useCallback(() => {
    if (!isEdit) return;
    Alert.alert(
      'Eliminar trabajador',
      `¿Eliminar a ${nombres} ${apellidos}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await repo.deleteTrabajador(id as string);
              router.back();
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'No se pudo eliminar';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  }, [isEdit, id, nombres, apellidos, router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} testID="btn-back">
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{title}</Text>
          {isEdit ? (
            <TouchableOpacity onPress={eliminar} style={styles.delBtn} hitSlop={10} testID="btn-delete">
              <Trash2 size={20} color={COLORS.danger} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Identificación</Text>

            <Text style={styles.label}>RUT</Text>
            <View style={styles.input}>
              <IdCard size={20} color={COLORS.textMuted} />
              <TextInput
                value={rut}
                onChangeText={(v) => setRut(formatRut(v))}
                placeholder="12.345.678-9"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                autoCapitalize="characters"
                testID="input-rut"
              />
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nombres</Text>
                <View style={styles.input}>
                  <UserIcon size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={nombres}
                    onChangeText={setNombres}
                    placeholder="María Paz"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    testID="input-nombres"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Apellidos</Text>
                <View style={styles.input}>
                  <TextInput
                    value={apellidos}
                    onChangeText={setApellidos}
                    placeholder="González"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    testID="input-apellidos"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Teléfono</Text>
            <View style={styles.input}>
              <Phone size={18} color={COLORS.textMuted} />
              <TextInput
                value={telefono}
                onChangeText={setTelefono}
                placeholder="+56 9 1234 5678"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="phone-pad"
                testID="input-telefono"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Laboral</Text>

            <Text style={styles.label}>Cargo</Text>
            <View style={styles.input}>
              <Briefcase size={18} color={COLORS.textMuted} />
              <TextInput
                value={cargo}
                onChangeText={setCargo}
                placeholder="Operario en terreno"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-cargo"
              />
            </View>

            <Text style={styles.label}>Empresa</Text>
            <View style={styles.input}>
              <Building2 size={18} color={COLORS.textMuted} />
              <TextInput
                value={empresa}
                onChangeText={setEmpresa}
                placeholder="Constructora Andes"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-empresa"
              />
            </View>

            <Text style={styles.label}>Rol</Text>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const active = rol === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                    onPress={() => setRol(r.key)}
                    activeOpacity={0.85}
                    testID={`role-${r.key}`}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Punto de trabajo asignado</Text>
            <Text style={styles.helper}>
              Selecciona la obra o punto donde debe marcar asistencia este trabajador.
              La geocerca se valida con este punto.
            </Text>
            <View style={styles.puntosList}>
              <TouchableOpacity
                style={[
                  styles.puntoItem,
                  puntoTrabajoId === null && styles.puntoItemActive,
                ]}
                onPress={() => setPuntoTrabajoId(null)}
                activeOpacity={0.85}
                testID="punto-none"
              >
                <View
                  style={[
                    styles.puntoIcon,
                    puntoTrabajoId === null && styles.puntoIconActive,
                  ]}
                >
                  <MapPin
                    size={16}
                    color={
                      puntoTrabajoId === null
                        ? COLORS.primary
                        : COLORS.textMuted
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.puntoName}>Sin punto asignado</Text>
                  <Text style={styles.puntoAddr}>
                    El trabajador no tendrá validación de geocerca
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    puntoTrabajoId === null && styles.radioActive,
                  ]}
                >
                  {puntoTrabajoId === null && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
              {puntos.map((p) => {
                const active = puntoTrabajoId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.puntoItem, active && styles.puntoItemActive]}
                    onPress={() => setPuntoTrabajoId(p.id)}
                    activeOpacity={0.85}
                    testID={`punto-${p.id}`}
                  >
                    <View
                      style={[
                        styles.puntoIcon,
                        active && styles.puntoIconActive,
                      ]}
                    >
                      <MapPin
                        size={16}
                        color={active ? COLORS.primary : COLORS.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.puntoName}>{p.nombre_lugar}</Text>
                      <Text style={styles.puntoAddr} numberOfLines={1}>
                        {p.direccion}
                      </Text>
                      <Text style={styles.puntoRadio}>
                        Radio {p.radio_permitido_metros} m
                      </Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Horario del trabajador</Text>
            <Text style={styles.helper}>
              Define el horario laboral. Se usa para calcular horas extras y atrasos.
            </Text>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora entrada</Text>
                <View style={styles.input}>
                  <Clock3 size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={horario.hora_entrada}
                    onChangeText={(v) => setHorario((h) => ({ ...h, hora_entrada: v }))}
                    placeholder="08:30"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="numbers-and-punctuation"
                    testID="input-hora-entrada"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora salida</Text>
                <View style={styles.input}>
                  <Clock3 size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={horario.hora_salida}
                    onChangeText={(v) => setHorario((h) => ({ ...h, hora_salida: v }))}
                    placeholder="17:30"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="numbers-and-punctuation"
                    testID="input-hora-salida"
                  />
                </View>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.toggleIcon}>
                  <Clock3 size={18} color={horario.usa_colacion ? COLORS.primary : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Incluye colación</Text>
                  <Text style={styles.toggleSub}>
                    {horario.usa_colacion ? 'Se descuenta de la jornada' : 'Jornada continua'}
                  </Text>
                </View>
              </View>
              <Switch
                value={horario.usa_colacion}
                onValueChange={(v) => setHorario((h) => ({ ...h, usa_colacion: v }))}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
                testID="switch-usa-colacion"
              />
            </View>

            {horario.usa_colacion && (
              <View>
                <Text style={styles.label}>Duración colación (minutos)</Text>
                <View style={styles.input}>
                  <Timer size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={String(horario.minutos_colacion)}
                    onChangeText={(v) =>
                      setHorario((h) => ({
                        ...h,
                        minutos_colacion: Number(v.replace(/\D/g, '')) || 0,
                      }))
                    }
                    placeholder="60"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="number-pad"
                    testID="input-minutos-colacion"
                  />
                </View>
                <Text style={styles.helper}>
                  El trabajador marca salida/regreso de colación a la hora que le corresponda ese día.
                  Si no almuerza (con aprobación del admin), ese tiempo cuenta como hora extra.
                </Text>
              </View>
            )}

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Horas jornada</Text>
                <View style={styles.input}>
                  <Timer size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={String(horario.horas_jornada)}
                    onChangeText={(v) =>
                      setHorario((h) => ({ ...h, horas_jornada: Number(v.replace(/[^\d.]/g, '')) || 0 }))
                    }
                    placeholder="8"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="decimal-pad"
                    testID="input-horas-jornada"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tolerancia (min)</Text>
                <View style={styles.input}>
                  <Timer size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={String(horario.tolerancia_minutos)}
                    onChangeText={(v) =>
                      setHorario((h) => ({ ...h, tolerancia_minutos: Number(v.replace(/\D/g, '')) || 0 }))
                    }
                    placeholder="10"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Días laborables</Text>
            <View style={styles.roles}>
              {[
                { n: 1, l: 'L' },
                { n: 2, l: 'M' },
                { n: 3, l: 'X' },
                { n: 4, l: 'J' },
                { n: 5, l: 'V' },
                { n: 6, l: 'S' },
                { n: 0, l: 'D' },
              ].map((d) => {
                const active = horario.dias_laborables.includes(d.n);
                return (
                  <TouchableOpacity
                    key={d.n}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                    onPress={() =>
                      setHorario((h) => ({
                        ...h,
                        dias_laborables: active
                          ? h.dias_laborables.filter((x) => x !== d.n)
                          : [...h.dias_laborables, d.n].sort(),
                      }))
                    }
                    activeOpacity={0.85}
                    testID={`dia-${d.n}`}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {d.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.toggleIcon}>
                  <ShieldCheck size={18} color={activo ? COLORS.success : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Cuenta activa</Text>
                  <Text style={styles.toggleSub}>
                    {activo ? 'Puede iniciar sesión y marcar' : 'Acceso bloqueado'}
                  </Text>
                </View>
              </View>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
                testID="switch-activo"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Acceso</Text>

            {isEdit && (
              <View style={styles.toggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.toggleIcon}>
                    <KeyRound size={18} color={resetPass ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Restablecer contraseña</Text>
                    <Text style={styles.toggleSub}>
                      {resetPass ? 'Se cambiará por la nueva contraseña' : 'La contraseña actual se mantiene'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={resetPass}
                  onValueChange={setResetPass}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  testID="switch-reset-pass"
                />
              </View>
            )}

            {(!isEdit || resetPass) && (
              <>
                <Text style={styles.label}>{isEdit ? 'Nueva contraseña' : 'Contraseña inicial'}</Text>
                <View style={styles.input}>
                  <Lock size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 4 caracteres"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    testID="input-password"
                  />
                  <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={10} testID="btn-toggle-pass">
                    {showPass ? (
                      <EyeOff size={18} color={COLORS.textMuted} />
                    ) : (
                      <Eye size={18} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirmar contraseña</Text>
                <View style={styles.input}>
                  <Lock size={18} color={COLORS.textMuted} />
                  <TextInput
                    value={password2}
                    onChangeText={setPassword2}
                    placeholder="Repite la contraseña"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    testID="input-password2"
                  />
                </View>

                {!isEdit && (
                  <TouchableOpacity
                    onPress={() => {
                      setPassword('123456');
                      setPassword2('123456');
                    }}
                    style={styles.suggestBtn}
                    testID="btn-suggest-pass"
                  >
                    <Text style={styles.suggestText}>Usar contraseña por defecto 123456</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, saving && styles.ctaDisabled]}
            onPress={guardar}
            disabled={saving}
            activeOpacity={0.85}
            testID="btn-save"
          >
            <Save size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear trabajador'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  delBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 10,
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
    paddingHorizontal: 12,
    height: 48,
  },
  inputText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  row2: { flexDirection: 'row', gap: 10 },
  roles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  roleChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  roleTextActive: { color: COLORS.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  notice: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  noticeBold: { fontWeight: '800', color: COLORS.text },
  suggestBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  suggestText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  helper: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -2,
    marginBottom: 10,
    lineHeight: 17,
  },
  puntosList: { gap: 8 },
  puntoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  puntoItemActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  puntoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  puntoIconActive: { backgroundColor: '#FFFFFF' },
  puntoName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  puntoAddr: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  puntoRadio: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  footer: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
