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
  Smartphone as AppIcon,
  Mail,
  Calendar,
  DollarSign,
  ShieldCheck,
  MapPin,
  Clock3,
  Timer,
} from 'lucide-react-native';
import {
  COLORS,
  DIAS_HORARIO,
  DiaHorario,
  HorarioTrabajador,
  HORARIO_DEFAULT,
  PermisosTrabajador,
  PuntoTrabajo,
  recalcHorarioDerivados,
  Trabajador,
} from '@/types';
import { formatRut, validateRut, cleanRut } from '@/utils/rut';
import { repo } from '@/services/repository';
import { useAuth } from '@/contexts/AuthContext';

/** Normaliza el tel\u00e9fono a m\u00e1ximo 8 d\u00edgitos (sin prefijo +569). */
function normalizePhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '');
  // si vino con prefijo 569... lo quitamos
  const trimmed = digits.startsWith('569') ? digits.slice(3) : digits.startsWith('56') ? digits.slice(2) : digits;
  return trimmed.slice(0, 8);
}

const DIA_LABEL: Record<DiaHorario, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Mi\u00e9rcoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'S\u00e1bado',
  domingo: 'Domingo',
};

const PERMISO_FIELDS: { key: keyof PermisosTrabajador; label: string; sub: string }[] = [
  { key: 'puede_cotizar', label: 'Cotizaciones', sub: 'Crear y consultar cotizaciones' },
  { key: 'puede_oc', label: '\u00d3rdenes de compra', sub: 'Gestionar OC' },
  { key: 'puede_rrhh', label: 'RRHH / Documentos', sub: 'Acceso a m\u00f3dulo de RRHH' },
  { key: 'puede_finanzas', label: 'Finanzas', sub: 'Acceso a m\u00f3dulo de finanzas' },
];

export default function TrabajadorFormScreen(): React.ReactElement {
  const router = useRouter();
  const { trabajador: adminUser } = useAuth();
  const { id, empresa: empresaParam } = useLocalSearchParams<{ id?: string; empresa?: string }>();
  const isEdit = !!id;
  const editingSelf = isEdit && adminUser?.id === id;

  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);

  const [rut, setRut] = useState<string>('');
  const [nombres, setNombres] = useState<string>('');
  const [apellidos, setApellidos] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [cargo, setCargo] = useState<string>('');
  const [empresa, setEmpresa] = useState<string>(empresaParam ?? '');
  const [email, setEmail] = useState<string>('');
  const [sueldo, setSueldo] = useState<string>('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fechaIngreso, setFechaIngreso] = useState<string>(today);
  const [estado, setEstado] = useState<'activo' | 'inactivo'>('activo');
  const [appActiva, setAppActiva] = useState<boolean>(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [puntos, setPuntos] = useState<PuntoTrabajo[]>([]);
  const [puntoTrabajoId, setPuntoTrabajoId] = useState<string | null>(null);
  const [horario, setHorario] = useState<HorarioTrabajador>(HORARIO_DEFAULT);
  const [permisos, setPermisos] = useState<PermisosTrabajador>({
    puede_cotizar: false,
    puede_oc: false,
    puede_rrhh: false,
    puede_finanzas: false,
  });

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
          setTelefono(normalizePhone(t.telefono));
          setCargo(t.cargo);
          setEmpresa(t.empresa);
          setEmail(t.email ?? '');
          setSueldo(t.sueldo != null ? String(t.sueldo) : '');
          setFechaIngreso(t.fecha_ingreso ?? today);
          setEstado((t.estado === 'inactivo' ? 'inactivo' : 'activo') as 'activo' | 'inactivo');
          setAppActiva(!!t.app_activa);
          setHorario(t.horario ?? HORARIO_DEFAULT);
          setUsuarioId(t.usuario_id ?? null);
          setPermisos({
            puede_cotizar: !!t.permisos?.puede_cotizar,
            puede_oc: !!t.permisos?.puede_oc,
            puede_rrhh: !!t.permisos?.puede_rrhh,
            puede_finanzas: !!t.permisos?.puede_finanzas,
          });
        }
        const asig = await repo.getAsignacionActiva(id as string);
        setPuntoTrabajoId(asig?.punto_trabajo_id ?? null);
        setLoading(false);
      }
    })();
  }, [id, isEdit, today]);

  const title = useMemo(() => (isEdit ? 'Editar trabajador' : 'Nuevo trabajador'), [isEdit]);

  const updateDia = useCallback((dia: DiaHorario, active: boolean) => {
    setHorario((h) => recalcHorarioDerivados({ ...h, [dia]: active }));
  }, []);

  const updateDiaHora = useCallback((key: keyof HorarioTrabajador, value: string) => {
    setHorario((h) => recalcHorarioDerivados({ ...h, [key]: value } as HorarioTrabajador));
  }, []);

  const guardar = useCallback(async () => {
    if (!validateRut(rut)) {
      Alert.alert('RUT inv\u00e1lido', 'Revisa el RUT ingresado');
      return;
    }
    if (nombres.trim().length < 2) {
      Alert.alert('Datos incompletos', 'Ingresa el nombre completo');
      return;
    }
    if (cargo.trim().length < 2) {
      Alert.alert('Cargo requerido', 'Indica el cargo del trabajador');
      return;
    }
    const sueldoNum = Number(sueldo.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(sueldoNum) || sueldoNum <= 0) {
      Alert.alert('Sueldo requerido', 'Ingresa un sueldo bruto mayor a 0');
      return;
    }
    const phoneClean = normalizePhone(telefono);
    if (phoneClean && phoneClean.length !== 8) {
      Alert.alert('Tel\u00e9fono inv\u00e1lido', 'El tel\u00e9fono debe tener 8 d\u00edgitos (sin el +569)');
      return;
    }
    const emailTrim = email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      Alert.alert('Email inv\u00e1lido', 'Revisa el correo ingresado');
      return;
    }
    const fechaTrim = (fechaIngreso || today).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTrim)) {
      Alert.alert('Fecha inv\u00e1lida', 'Usa el formato AAAA-MM-DD');
      return;
    }
    setSaving(true);
    try {
      let trabajadorId: string;
      const empresaIdAdmin = adminUser?.empresa_id ?? null;
      const horarioNormalizado = recalcHorarioDerivados(horario);
      if (isEdit) {
        const patch: Partial<Trabajador> = {
          rut: formatRut(rut),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: phoneClean,
          cargo: cargo.trim(),
          empresa: empresa.trim() || 'Sin empresa',
          email: emailTrim || undefined,
          fecha_ingreso: fechaTrim,
          sueldo: sueldoNum,
          horario: horarioNormalizado,
          permisos,
        };
        // El admin no puede modificar su propio acceso/estado
        if (!editingSelf) {
          patch.estado = estado;
          patch.activo = estado === 'activo';
          patch.app_activa = appActiva;
        }
        await repo.updateTrabajador(id as string, patch);
        trabajadorId = id as string;
      } else {
        const nuevo: Trabajador = {
          id: '',
          rut: formatRut(rut),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: phoneClean,
          activo: true,
          cargo: cargo.trim(),
          empresa: empresa.trim() || 'Sin empresa',
          email: emailTrim || undefined,
          fecha_ingreso: fechaTrim,
          supervisor_id: null,
          ultimo_login: null,
          rol: 'trabajador',
          sueldo: sueldoNum,
          horario: horarioNormalizado,
          app_activa: appActiva,
          estado: 'activo',
          permisos,
        };
        if (empresaIdAdmin) nuevo.empresa_id = empresaIdAdmin;
        const created = await repo.addTrabajador(nuevo);
        trabajadorId = created.id;
      }
      await repo.setAsignacionTrabajador(trabajadorId, puntoTrabajoId);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [
    isEdit,
    id,
    rut,
    nombres,
    apellidos,
    telefono,
    cargo,
    empresa,
    email,
    fechaIngreso,
    sueldo,
    estado,
    appActiva,
    router,
    puntoTrabajoId,
    horario,
    permisos,
    adminUser,
    editingSelf,
    today,
  ]);

  const eliminar = useCallback(() => {
    if (!isEdit) return;
    Alert.alert(
      'Eliminar trabajador',
      `\u00bfEliminar a ${nombres} ${apellidos}? Esta acci\u00f3n no se puede deshacer.`,
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} testID="btn-back">
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{title}</Text>
          {isEdit && !editingSelf ? (
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

            <Text style={styles.label}>Nombre completo</Text>
            <View style={styles.input}>
              <UserIcon size={18} color={COLORS.textMuted} />
              <TextInput
                value={nombres}
                onChangeText={setNombres}
                placeholder="Ej: María Paz"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-nombres"
              />
            </View>

            <Text style={styles.label}>Apellidos (opcional)</Text>
            <View style={styles.input}>
              <TextInput
                value={apellidos}
                onChangeText={setApellidos}
                placeholder="Ej: González Soto"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-apellidos"
              />
            </View>

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

            <Text style={styles.label}>Email</Text>
            <View style={styles.input}>
              <Mail size={18} color={COLORS.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="nombre@empresa.cl"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-email"
              />
            </View>

            <Text style={styles.label}>Teléfono (8 dígitos)</Text>
            <View style={styles.input}>
              <Phone size={18} color={COLORS.textMuted} />
              <Text style={styles.phonePrefix}>+56 9</Text>
              <TextInput
                value={telefono}
                onChangeText={(v) => setTelefono(normalizePhone(v))}
                placeholder="12345678"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="number-pad"
                maxLength={8}
                testID="input-telefono"
              />
            </View>
            <Text style={styles.helper}>Se guardan solo los 8 dígitos, sin el prefijo +569.</Text>
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

            <Text style={styles.label}>Sueldo bruto (CLP)</Text>
            <View style={styles.input}>
              <DollarSign size={18} color={COLORS.textMuted} />
              <TextInput
                value={sueldo}
                onChangeText={(v) => setSueldo(v.replace(/[^\d]/g, ''))}
                placeholder="600000"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="number-pad"
                testID="input-sueldo"
              />
            </View>

            <Text style={styles.label}>Fecha de ingreso</Text>
            <View style={styles.input}>
              <Calendar size={18} color={COLORS.textMuted} />
              <TextInput
                value={fechaIngreso}
                onChangeText={setFechaIngreso}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                autoCapitalize="none"
                testID="input-fecha-ingreso"
              />
            </View>

            {isEdit && !editingSelf && (
              <>
                <Text style={styles.label}>Estado</Text>
                <View style={styles.roles}>
                  {(['activo', 'inactivo'] as const).map((e) => {
                    const active = estado === e;
                    return (
                      <TouchableOpacity
                        key={e}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        onPress={() => setEstado(e)}
                        activeOpacity={0.85}
                        testID={`estado-${e}`}
                      >
                        <Text style={[styles.roleText, active && styles.roleTextActive]}>
                          {e === 'activo' ? 'Activo' : 'Inactivo'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Punto de trabajo asignado</Text>
            <Text style={styles.helper}>
              Selecciona la obra o punto donde debe marcar asistencia. La geocerca se valida con este punto.
            </Text>
            <View style={styles.puntosList}>
              <TouchableOpacity
                style={[styles.puntoItem, puntoTrabajoId === null && styles.puntoItemActive]}
                onPress={() => setPuntoTrabajoId(null)}
                activeOpacity={0.85}
                testID="punto-none"
              >
                <View style={[styles.puntoIcon, puntoTrabajoId === null && styles.puntoIconActive]}>
                  <MapPin size={16} color={puntoTrabajoId === null ? COLORS.primary : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.puntoName}>Sin punto asignado</Text>
                  <Text style={styles.puntoAddr}>El trabajador no tendrá validación de geocerca</Text>
                </View>
                <View style={[styles.radio, puntoTrabajoId === null && styles.radioActive]}>
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
                    <View style={[styles.puntoIcon, active && styles.puntoIconActive]}>
                      <MapPin size={16} color={active ? COLORS.primary : COLORS.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.puntoName}>{p.nombre_lugar}</Text>
                      <Text style={styles.puntoAddr} numberOfLines={1}>{p.direccion}</Text>
                      <Text style={styles.puntoRadio}>Radio {p.radio_permitido_metros} m</Text>
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
              Marca los días laborables y define la hora de entrada/salida para cada uno.
            </Text>

            {DIAS_HORARIO.map((dia) => {
              const active = horario[dia];
              return (
                <View key={dia} style={styles.diaRow}>
                  <View style={styles.diaHeader}>
                    <Text style={styles.diaLabel}>{DIA_LABEL[dia]}</Text>
                    <Switch
                      value={!!active}
                      onValueChange={(v) => updateDia(dia, v)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#FFFFFF"
                      testID={`switch-${dia}`}
                    />
                  </View>
                  {active && (
                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>Entrada</Text>
                        <View style={styles.input}>
                          <Clock3 size={16} color={COLORS.textMuted} />
                          <TextInput
                            value={horario[`${dia}_entrada` as const]}
                            onChangeText={(v) => updateDiaHora(`${dia}_entrada` as keyof HorarioTrabajador, v)}
                            placeholder="08:30"
                            placeholderTextColor={COLORS.textMuted}
                            style={styles.inputText}
                            keyboardType="numbers-and-punctuation"
                            testID={`input-${dia}-entrada`}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>Salida</Text>
                        <View style={styles.input}>
                          <Clock3 size={16} color={COLORS.textMuted} />
                          <TextInput
                            value={horario[`${dia}_salida` as const]}
                            onChangeText={(v) => updateDiaHora(`${dia}_salida` as keyof HorarioTrabajador, v)}
                            placeholder="17:30"
                            placeholderTextColor={COLORS.textMuted}
                            style={styles.inputText}
                            keyboardType="numbers-and-punctuation"
                            testID={`input-${dia}-salida`}
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={styles.label}>Tiempo de colación (minutos)</Text>
            <View style={styles.input}>
              <Timer size={18} color={COLORS.textMuted} />
              <TextInput
                value={String(horario.minutos_colacion ?? 0)}
                onChangeText={(v) =>
                  setHorario((h) =>
                    recalcHorarioDerivados({
                      ...h,
                      minutos_colacion: Number(v.replace(/\D/g, '')) || 0,
                    }),
                  )
                }
                placeholder="60"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="number-pad"
                testID="input-minutos-colacion"
              />
            </View>
            <Text style={styles.helper}>Usa 0 si no hay colación (jornada continua).</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Permisos del trabajador</Text>
            <Text style={styles.helper}>Activa los módulos del ERP a los que tendrá acceso.</Text>
            {PERMISO_FIELDS.map((p) => (
              <View key={p.key} style={styles.toggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.toggleIcon}>
                    <ShieldCheck size={18} color={permisos[p.key] ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{p.label}</Text>
                    <Text style={styles.toggleSub}>{p.sub}</Text>
                  </View>
                </View>
                <Switch
                  value={!!permisos[p.key]}
                  onValueChange={(v) => setPermisos((prev) => ({ ...prev, [p.key]: v }))}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  testID={`switch-${p.key}`}
                />
              </View>
            ))}
          </View>

          {!editingSelf && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Acceso a la app</Text>
              <View style={styles.toggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.toggleIcon}>
                    <AppIcon size={18} color={appActiva ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Cuenta activa</Text>
                    <Text style={styles.toggleSub}>
                      {appActiva ? 'Puede iniciar sesi\u00f3n en la app' : 'Acceso a la app bloqueado'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={appActiva}
                  onValueChange={setAppActiva}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  testID="switch-app-activa"
                />
              </View>
              {!usuarioId && appActiva && (
                <Text style={styles.helper}>
                  Este trabajador aún no tiene cuenta de login. El acceso queda registrado, pero la cuenta debe crearse desde el ERP.
                </Text>
              )}
            </View>
          )}

          {isEdit && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Restablecer contraseña</Text>
              <Text style={styles.helper}>
                Por seguridad, las contraseñas solo se restablecen desde el ERP. Esta función no está disponible en la app.
              </Text>
            </View>
          )}
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
  smallLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  phonePrefix: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
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
  roleChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  roleText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  roleTextActive: { color: COLORS.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
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
  helper: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -2,
    marginBottom: 10,
    lineHeight: 17,
  },
  diaRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  diaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diaLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
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
  puntoItemActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
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
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
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
