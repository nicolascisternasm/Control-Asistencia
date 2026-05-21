import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  MapPin,
  Clock3,
  Shield,
  UserPlus,
  Pencil,
  Search,
  ChevronRight,
  Building2,
  Ban,
  Coffee,
  Plane,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { TextInput } from 'react-native';
import {
  COLORS,
  Marcacion,
  SolicitudPassword,
  SolicitudOmitirColacion,
  TIPO_MARCACION_LABEL,
  Trabajador,
} from '@/types';
import { repo } from '@/services/repository';
import { useAuth } from '@/contexts/AuthContext';
import { useVacaciones } from '@/contexts/VacacionesContext';
import { useToast } from '@/contexts/ToastContext';
import { formatRut } from '@/utils/rut';
import { generateRandomPassword } from '@/utils/crypto';

export default function AdminScreen(): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const { trabajador: adminUser } = useAuth();
  const empresaAdmin = adminUser?.empresa ?? '';
  const { solicitudes: vacSolicitudes, recargar: recargarVac } = useVacaciones();
  const vacPendientes = useMemo(
    () => vacSolicitudes.filter((s) => s.estado === 'pendiente'),
    [vacSolicitudes],
  );
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPassword[]>([]);
  const [solicitudesColacion, setSolicitudesColacion] = useState<SolicitudOmitirColacion[]>([]);
  const [alertas, setAlertas] = useState<Marcacion[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [pagina, setPagina] = useState<number>(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setRefreshing(true);
    const [t, s, m, sc] = await Promise.all([
      repo.getAllTrabajadores(empresaAdmin),
      repo.getSolicitudes(),
      repo.getMarcaciones(),
      repo.getSolicitudesOmitirColacion(),
    ]);
    setTrabajadores(t);
    setSolicitudes(s);
    setSolicitudesColacion(sc);
    setAlertas(
      m
        .filter((x) => x.estado_validacion !== 'valida')
        .sort((a, b) => b.fecha_hora_servidor.localeCompare(a.fecha_hora_servidor))
        .slice(0, 20),
    );
    await recargarVac();
    setRefreshing(false);
  }, [recargarVac, empresaAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = q
      ? trabajadores.filter((t) =>
          `${t.nombres} ${t.apellidos} ${t.rut} ${t.cargo}`.toLowerCase().includes(q),
        )
      : trabajadores;
    return all;
  }, [trabajadores, query]);

  const filtradosPagina = useMemo(
    () => filtrados.slice(0, pagina * PAGE_SIZE),
    [filtrados, pagina],
  );
  const hayMas = filtradosPagina.length < filtrados.length;

  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const marcacionesHoy = useMemo(
    () => alertas.filter((m) => m.fecha_hora_servidor.slice(0, 10) === hoy),
    [alertas, hoy],
  );
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente');
  const pendientesColacion = solicitudesColacion.filter((s) => s.estado === 'pendiente');

  const resolverColacion = async (
    s: SolicitudOmitirColacion,
    accion: 'aprobada' | 'rechazada',
  ) => {
    Alert.alert(
      accion === 'aprobada' ? 'Aprobar omitir colación' : 'Rechazar solicitud',
      `${s.trabajador_nombre} · ${s.fecha}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await repo.updateSolicitudOmitirColacion(s.id, {
              estado: accion,
              resuelto_en: new Date().toISOString(),
              resuelto_por: 'admin',
            });
            showToast(
              accion === 'aprobada' ? 'Colación aprobada correctamente' : 'Solicitud rechazada',
              accion === 'aprobada' ? 'success' : 'info',
            );
            load();
          },
        },
      ],
    );
  };

  const resolver = async (s: SolicitudPassword, accion: 'resuelta' | 'rechazada') => {
    Alert.alert(
      accion === 'resuelta' ? 'Resolver solicitud' : 'Rechazar solicitud',
      `RUT ${formatRut(s.rut)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await repo.updateSolicitud(s.id, {
              estado: accion,
              fecha_resolucion: new Date().toISOString(),
              resuelto_por: 'admin',
            });
            if (accion === 'resuelta') {
              const newPassword = generateRandomPassword();
              await repo.setPassword(s.rut, newPassword);
              showToast(`Nueva contraseña para ${formatRut(s.rut)}: ${newPassword}`, 'success');
            } else {
              showToast('Solicitud rechazada', 'info');
            }
            load();
          },
        },
      ],
    );
  };

  const trabajadorById = (id: string | null): Trabajador | undefined =>
    trabajadores.find((t) => t.id === id);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Shield size={22} color={COLORS.primary} />
          <Text style={styles.title}>Panel Admin</Text>
        </View>
        <Text style={styles.subtitle}>
          {empresaAdmin ? `${empresaAdmin} · Gestión de equipo` : 'Gestión de equipo y solicitudes'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <View style={styles.metrics}>
          <MetricCard
            icon={<Users size={22} color={COLORS.primary} />}
            num={trabajadores.filter((t) => t.rol === 'trabajador').length}
            label="Trabajadores"
            tint={COLORS.primaryLight}
          />
          <MetricCard
            icon={<KeyRound size={22} color={COLORS.warning} />}
            num={pendientes.length}
            label="Sol. password"
            tint={COLORS.warningLight}
          />
          <MetricCard
            icon={<AlertTriangle size={22} color={COLORS.danger} />}
            num={marcacionesHoy.length}
            label="Alertas hoy"
            tint={COLORS.dangerLight}
          />
        </View>

        {pendientesColacion.length > 0 && (
          <View style={styles.pendingBanner}>
            <Ban size={16} color={COLORS.warning} />
            <Text style={styles.pendingBannerText}>
              {pendientesColacion.length} solicitud{pendientesColacion.length === 1 ? '' : 'es'} de omitir colación pendiente{pendientesColacion.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.manageCard}
          onPress={() => router.push('/puntos')}
          activeOpacity={0.85}
          testID="btn-manage-puntos"
        >
          <View style={styles.manageIcon}>
            <Building2 size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageTitle}>Puntos de trabajo</Text>
            <Text style={styles.manageSub}>
              Administra obras, faenas y geocercas disponibles
            </Text>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageCard}
          onPress={() => router.push('/vacaciones')}
          activeOpacity={0.85}
          testID="btn-manage-vacaciones"
        >
          <View style={[styles.manageIcon, { backgroundColor: COLORS.successLight }]}>
            <Plane size={20} color={COLORS.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageTitle}>Solicitudes de vacaciones</Text>
            <Text style={styles.manageSub}>
              {vacPendientes.length > 0
                ? `${vacPendientes.length} pendiente${vacPendientes.length === 1 ? '' : 's'} de revisar`
                : 'Sin solicitudes pendientes'}
            </Text>
          </View>
          {vacPendientes.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{vacPendientes.length}</Text>
            </View>
          )}
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <Text style={styles.section}>Solicitudes de contraseña</Text>
        {pendientes.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={28} color={COLORS.success} />
            <Text style={styles.emptyText}>No hay solicitudes pendientes</Text>
          </View>
        ) : (
          pendientes.map((s) => {
            const t = trabajadorById(s.trabajador_id);
            return (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarSm}>
                    <KeyRound size={16} color={COLORS.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {t ? `${t.nombres} ${t.apellidos}` : 'Trabajador no registrado'}
                    </Text>
                    <Text style={styles.cardMeta}>
                      RUT {formatRut(s.rut)} · {s.telefono}
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                    onPress={() => resolver(s, 'resuelta')}
                  >
                    <Text style={styles.actionText}>Resolver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionSecondary]}
                    onPress={() => resolver(s, 'rechazada')}
                  >
                    <Text style={[styles.actionText, { color: COLORS.textSecondary }]}>
                      Rechazar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.section}>Solicitudes omitir colación</Text>
        {pendientesColacion.length === 0 ? (
          <View style={styles.empty}>
            <Coffee size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Sin solicitudes pendientes</Text>
          </View>
        ) : (
          pendientesColacion.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatarSm, { backgroundColor: COLORS.warningLight }]}>
                  <Ban size={16} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{s.trabajador_nombre}</Text>
                  <Text style={styles.cardMeta}>
                    {s.fecha} · Solicita no almorzar
                  </Text>
                  {!!s.motivo && (
                    <Text style={[styles.obs, { color: COLORS.textSecondary, marginTop: 4 }]}>
                      “{s.motivo}”
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                  onPress={() => resolverColacion(s, 'aprobada')}
                  testID={`btn-aprobar-colacion-${s.id}`}
                >
                  <Text style={styles.actionText}>Aprobar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionSecondary]}
                  onPress={() => resolverColacion(s, 'rechazada')}
                >
                  <Text style={[styles.actionText, { color: COLORS.textSecondary }]}>
                    Rechazar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={styles.section}>Alertas de marcación</Text>
        {alertas.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={28} color={COLORS.success} />
            <Text style={styles.emptyText}>Sin alertas recientes</Text>
          </View>
        ) : (
          alertas.slice(0, 10).map((m) => {
            const t = trabajadorById(m.trabajador_id);
            const fh = new Date(m.fecha_hora_servidor);
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.avatarSm,
                      {
                        backgroundColor:
                          m.estado_validacion === 'alerta'
                            ? COLORS.dangerLight
                            : COLORS.warningLight,
                      },
                    ]}
                  >
                    <AlertTriangle
                      size={16}
                      color={
                        m.estado_validacion === 'alerta' ? COLORS.danger : COLORS.warning
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {t ? `${t.nombres} ${t.apellidos}` : 'Trabajador'} ·{' '}
                      {TIPO_MARCACION_LABEL[m.tipo_marcacion]}
                    </Text>
                    <View style={styles.metaLine}>
                      <Clock3 size={11} color={COLORS.textMuted} />
                      <Text style={styles.cardMeta}>
                        {fh.toLocaleString('es-CL')}
                      </Text>
                    </View>
                    {!!m.observacion && (
                      <View style={styles.metaLine}>
                        <MapPin size={11} color={COLORS.textMuted} />
                        <Text style={styles.obs}>{m.observacion}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Equipo ({trabajadores.length})</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/trabajador-form', params: { empresa: empresaAdmin } })}
            activeOpacity={0.85}
            testID="btn-add-trabajador"
          >
            <UserPlus size={14} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={(v) => { setQuery(v); setPagina(1); }}
            placeholder="Buscar por nombre, RUT o cargo"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            testID="input-search-trabajador"
          />
        </View>

        {filtrados.length === 0 ? (
          <View style={styles.empty}>
            <Users size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Sin resultados</Text>
          </View>
        ) : (
          <>
            {filtradosPagina.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/trabajador-form', params: { id: t.id } })}
                activeOpacity={0.7}
                testID={`row-trabajador-${t.id}`}
              >
                <View style={styles.avatarLg}>
                  <Text style={styles.avatarLgText}>
                    {t.nombres[0]}
                    {t.apellidos[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {t.nombres} {t.apellidos}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatRut(t.rut)} · {t.cargo}
                  </Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>
                      {t.rol === 'admin' ? 'Administrador' : t.rol === 'supervisor' ? 'Supervisor' : 'Trabajador'}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View
                    style={[
                      styles.tag,
                      t.activo ? { backgroundColor: COLORS.successLight } : { backgroundColor: COLORS.dangerLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: t.activo ? COLORS.success : COLORS.danger },
                      ]}
                    >
                      {t.activo ? 'Activo' : 'Bloqueado'}
                    </Text>
                  </View>
                  <Pencil size={14} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
            {hayMas && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setPagina((p) => p + 1)}
                activeOpacity={0.85}
              >
                <Text style={styles.loadMoreText}>
                  Mostrar más ({filtrados.length - filtradosPagina.length} restantes)
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  num,
  label,
  tint,
}: {
  icon: React.ReactNode;
  num: number;
  label: string;
  tint: string;
}): React.ReactElement {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.metricNum}>{num}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 32 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricNum: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  metricLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarSm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  obs: { fontSize: 12, color: COLORS.warning },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSecondary: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 22,
    borderRadius: 14,
    gap: 8,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  avatarLg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLgText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  rolePillText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  manageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  manageIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  manageSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.warningLight,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  pendingBannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.warning },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
