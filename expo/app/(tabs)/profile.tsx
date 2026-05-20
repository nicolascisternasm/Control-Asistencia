import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  Bell,
  MapPin,
  Phone,
  Briefcase,
  Building2,
  IdCard,
  Shield,
  ChevronRight,
  Plane,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useVacaciones } from '@/contexts/VacacionesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMarcaciones } from '@/contexts/MarcacionesContext';
import { COLORS } from '@/types';
import { formatRut } from '@/utils/rut';

export default function ProfileScreen(): React.ReactElement {
  const router = useRouter();
  const { trabajador, logout, isAdmin } = useAuth();
  const { puntoAsignado, marcaciones } = useMarcaciones();
  const { solicitudes: vacSolicitudes } = useVacaciones();
  const vacPendientes = vacSolicitudes.filter((s) => s.estado === 'pendiente').length;
  const [notifs, setNotifs] = useState<boolean>(true);
  const [recordatorio, setRecordatorio] = useState<boolean>(true);

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const iniciales =
    (trabajador?.nombres?.[0] ?? '') + (trabajador?.apellidos?.[0] ?? '');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
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
              {isAdmin ? 'Supervisor / Admin' : trabajador?.cargo}
            </Text>
          </View>

          <View style={styles.divider} />

          <Info icon={<IdCard size={18} color={COLORS.textSecondary} />} label="RUT" value={formatRut(trabajador?.rut ?? '')} />
          <Info icon={<Phone size={18} color={COLORS.textSecondary} />} label="Teléfono" value={trabajador?.telefono ?? '-'} />
          <Info icon={<Briefcase size={18} color={COLORS.textSecondary} />} label="Cargo" value={trabajador?.cargo ?? '-'} />
          <Info icon={<Building2 size={18} color={COLORS.textSecondary} />} label="Empresa" value={trabajador?.empresa ?? '-'} />
        </View>

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
    </SafeAreaView>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLbl}>{label}</Text>
        <Text style={styles.infoVal}>{value}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
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
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
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
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  infoVal: { fontSize: 14, color: COLORS.text, fontWeight: '600', marginTop: 2 },
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
  pointStatLbl: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pointStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
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
  version: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 20,
  },
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
});
