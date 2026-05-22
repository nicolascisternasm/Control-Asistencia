import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  Bell,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Building2,
  IdCard,
  Shield,
  ChevronRight,
  Plane,
  Calendar,
  KeyRound,
  Lock,
  X,
  Check,
  RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useVacaciones } from '@/contexts/VacacionesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMarcaciones } from '@/contexts/MarcacionesContext';
import { COLORS } from '@/types';
import { formatRut } from '@/utils/rut';

export default function ProfileScreen(): React.ReactElement {
  const router = useRouter();
  const { trabajador, logout, isAdmin, refreshTrabajador, changePassword } = useAuth();
  const { puntoAsignado, marcaciones } = useMarcaciones();
  const { solicitudes: vacSolicitudes } = useVacaciones();
  const vacPendientes = vacSolicitudes.filter((s) => s.estado === 'pendiente').length;
  const [notifs, setNotifs] = useState<boolean>(true);
  const [recordatorio, setRecordatorio] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pwdVisible, setPwdVisible] = useState<boolean>(false);

  useEffect(() => {
    refreshTrabajador().catch(() => {});
  }, [refreshTrabajador]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTrabajador();
    } finally {
      setRefreshing(false);
    }
  }, [refreshTrabajador]);

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const iniciales =
    (trabajador?.nombres?.[0] ?? '') + (trabajador?.apellidos?.[0] ?? '');

  const fechaIngresoFmt = useMemo(() => {
    if (!trabajador?.fecha_ingreso) return '-';
    try {
      const d = new Date(trabajador.fecha_ingreso);
      if (Number.isNaN(d.getTime())) return trabajador.fecha_ingreso;
      return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return trabajador.fecha_ingreso;
    }
  }, [trabajador?.fecha_ingreso]);

  const rolLabel = trabajador?.rol === 'admin'
    ? 'Administrador'
    : trabajador?.rol === 'supervisor'
    ? 'Supervisor'
    : 'Trabajador';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshBtn}
            disabled={refreshing}
            testID="btn-refresh-profile"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <RefreshCw size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{iniciales.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>
            {trabajador?.nombres} {trabajador?.apellidos}
          </Text>
          <View style={styles.roleTag}>
            <Shield size={13} color={COLORS.primary} />
            <Text style={styles.roleText}>
              {isAdmin ? rolLabel : trabajador?.cargo || rolLabel}
            </Text>
          </View>

          <View style={styles.readonlyBadge}>
            <Lock size={12} color={COLORS.textSecondary} />
            <Text style={styles.readonlyBadgeText}>
              Datos gestionados por tu administrador
            </Text>
          </View>

          <View style={styles.divider} />

          <Info icon={<Mail size={18} color={COLORS.textSecondary} />} label="Email" value={trabajador?.email || '-'} />
          <Info icon={<IdCard size={18} color={COLORS.textSecondary} />} label="RUT" value={formatRut(trabajador?.rut ?? '')} />
          <Info icon={<Phone size={18} color={COLORS.textSecondary} />} label="Teléfono" value={trabajador?.telefono || '-'} />
          <Info
            icon={<Building2 size={18} color={COLORS.textSecondary} />}
            label={isAdmin ? 'Empresa que administras' : 'Empresa a la que perteneces'}
            value={trabajador?.empresa || '-'}
            highlight
          />
          <Info icon={<Briefcase size={18} color={COLORS.textSecondary} />} label="Cargo" value={trabajador?.cargo || '-'} />
          <Info icon={<Calendar size={18} color={COLORS.textSecondary} />} label="Fecha de ingreso" value={fechaIngresoFmt} />
          <Info icon={<Shield size={18} color={COLORS.textSecondary} />} label="Rol" value={rolLabel} />
        </View>

        <Text style={styles.section}>Seguridad</Text>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setPwdVisible(true)}
          activeOpacity={0.85}
          testID="btn-cambiar-password"
        >
          <View style={styles.actionIcon}>
            <KeyRound size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Cambiar contraseña</Text>
            <Text style={styles.actionSub}>Actualiza tu clave de acceso</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {!isAdmin && (
          <>
            <Text style={styles.section}>Punto de trabajo</Text>
            {puntoAsignado ? (
              <View style={styles.card}>
                <View style={styles.pointHeader}>
                  <View style={styles.pointIcon}>
                    <MapPin size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pointName}>{puntoAsignado.nombre_lugar}</Text>
                    <Text style={styles.pointAddr}>{puntoAsignado.direccion}</Text>
                  </View>
                </View>
                <View style={styles.pointStats}>
                  <View style={styles.pointStat}>
                    <Text style={styles.pointStatNum}>{puntoAsignado.radio_permitido_metros}m</Text>
                    <Text style={styles.pointStatLbl}>Radio permitido</Text>
                  </View>
                  <View style={styles.pointStatDivider} />
                  <View style={styles.pointStat}>
                    <Text style={styles.pointStatNum}>{marcaciones.length}</Text>
                    <Text style={styles.pointStatLbl}>Marcaciones</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  Sin punto de trabajo asignado. Contacta a tu supervisor.
                </Text>
              </View>
            )}

            <Text style={styles.section}>Vacaciones</Text>
            <TouchableOpacity
              style={styles.vacCard}
              onPress={() => router.push('/vacaciones')}
              activeOpacity={0.85}
              testID="btn-mis-vacaciones"
            >
              <View style={styles.vacIcon}>
                <Plane size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vacTitle}>Mis solicitudes</Text>
                <Text style={styles.vacSub}>
                  {vacPendientes > 0
                    ? `${vacPendientes} pendiente${vacPendientes === 1 ? '' : 's'}`
                    : 'Solicita con 5 días hábiles de anticipación'}
                </Text>
              </View>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.section}>Preferencias</Text>
        <View style={styles.card}>
          <PrefRow
            icon={<Bell size={18} color={COLORS.primary} />}
            label="Notificaciones"
            value={notifs}
            onChange={setNotifs}
          />
          <View style={styles.divider} />
          <PrefRow
            icon={<Bell size={18} color={COLORS.primary} />}
            label="Recordatorio de marcación"
            value={recordatorio}
            onChange={setRecordatorio}
          />
        </View>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} activeOpacity={0.85}>
          <LogOut size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
          <ChevronRight size={18} color={COLORS.danger} />
        </TouchableOpacity>

        <Text style={styles.version}>ControlAsistencia v1.0</Text>
      </ScrollView>

      <ChangePasswordModal
        visible={pwdVisible}
        onClose={() => setPwdVisible(false)}
        onSave={async (newPassword) => {
          const remote = await changePassword(newPassword);
          return remote;
        }}
      />
    </SafeAreaView>
  );
}

function Info({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, highlight && styles.infoIconHi]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLbl}>{label}</Text>
        <Text style={[styles.infoVal, highlight && styles.infoValHi]}>{value}</Text>
      </View>
    </View>
  );
}

function PrefRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefIcon}>{icon}</View>
      <Text style={styles.prefLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ChangePasswordModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (newPassword: string) => Promise<boolean>;
}): React.ReactElement {
  const [pwd, setPwd] = useState<string>('');
  const [pwd2, setPwd2] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setPwd('');
      setPwd2('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (pwd.length < 6) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (pwd !== pwd2) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambos campos sean iguales.');
      return;
    }
    setSaving(true);
    try {
      const remote = await onSave(pwd);
      Alert.alert(
        'Contraseña actualizada',
        remote
          ? 'Tu nueva contraseña ya está activa.'
          : 'Se guardó localmente, pero no pudo sincronizarse con el servidor.',
      );
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      Alert.alert('No se pudo cambiar', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalIconBtn}>
            <X size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Cambiar contraseña</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.modalSaveBtn, saving && { opacity: 0.5 }]}
            disabled={saving}
            testID="btn-guardar-password"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.modalSaveTxt}>Guardar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Field
              label="Nueva contraseña"
              value={pwd}
              onChangeText={setPwd}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              label="Repetir contraseña"
              value={pwd2}
              onChangeText={setPwd2}
              placeholder="Repite la contraseña"
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.helpText}>
              La nueva contraseña reemplaza a la anterior en todos los dispositivos y en el ERP.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLbl}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry ?? false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    padding: 18,
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  roleTag: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  readonlyBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
  },
  readonlyBadgeText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIconHi: { backgroundColor: COLORS.primaryLight },
  infoLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  infoVal: { fontSize: 14, color: COLORS.text, fontWeight: '600', marginTop: 2 },
  infoValHi: { color: COLORS.primary, fontWeight: '800' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 14,
    marginBottom: 12,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  pointHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  pointAddr: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  pointStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 14,
  },
  pointStat: { flex: 1, alignItems: 'center' },
  pointStatNum: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  pointStatLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  pointStatDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.dangerLight,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  logoutText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.danger },
  version: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 20 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
  vacCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 14,
    marginBottom: 12,
  },
  vacIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vacTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  vacSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 90,
    justifyContent: 'center',
  },
  modalSaveTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  field: { marginBottom: 14 },
  fieldLbl: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
