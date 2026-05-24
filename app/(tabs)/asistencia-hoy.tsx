import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  XCircle,
  MapPin,
  Clock3,
  Users,
  Search,
  Navigation,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  COLORS,
  Marcacion,
  PuntoTrabajo,
  Trabajador,
  TIPO_MARCACION_LABEL,
} from '@/types';
import { repo } from '@/services/repository';
import { useAuth } from '@/contexts/AuthContext';
import { formatRut } from '@/utils/rut';

type Filtro = 'todos' | 'marcaron' | 'faltan';

interface EstadoTrabajador {
  trabajador: Trabajador;
  entrada: Marcacion | null;
  ultimaMarcacion: Marcacion | null;
  punto: PuntoTrabajo | null;
}

export default function AsistenciaHoyScreen(): React.ReactElement {
  const { trabajador: adminUser } = useAuth();
  const empresaAdmin = adminUser?.empresa ?? '';
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [marcaciones, setMarcaciones] = useState<Marcacion[]>([]);
  const [puntos, setPuntos] = useState<PuntoTrabajo[]>([]);
  const [asignaciones, setAsignaciones] = useState<
    { trabajador_id: string; punto: PuntoTrabajo | null }[]
  >([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const load = useCallback(async () => {
    setRefreshing(true);
    const [t, m, p] = await Promise.all([
      repo.getAllTrabajadores(empresaAdmin),
      repo.getMarcaciones(),
      repo.getPuntosTrabajo(),
    ]);
    const soloTrabajadores = t.filter((x) => x.rol === 'trabajador' && x.activo);
    const asigns = await Promise.all(
      soloTrabajadores.map(async (w) => ({
        trabajador_id: w.id,
        punto: await repo.getPuntoAsignado(w.id),
      })),
    );
    setTrabajadores(soloTrabajadores);
    setMarcaciones(m);
    setPuntos(p);
    setAsignaciones(asigns);
    setRefreshing(false);
  }, [empresaAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const estados = useMemo<EstadoTrabajador[]>(() => {
    return trabajadores.map((w) => {
      const suyas = marcaciones
        .filter(
          (m) =>
            m.trabajador_id === w.id &&
            m.fecha_hora_servidor.slice(0, 10) === hoy,
        )
        .sort((a, b) =>
          a.fecha_hora_servidor.localeCompare(b.fecha_hora_servidor),
        );
      const entrada = suyas.find((m) => m.tipo_marcacion === 'entrada') ?? null;
      const ultima = suyas.length > 0 ? suyas[suyas.length - 1] : null;
      const asig = asignaciones.find((a) => a.trabajador_id === w.id);
      return {
        trabajador: w,
        entrada,
        ultimaMarcacion: ultima,
        punto: asig?.punto ?? null,
      };
    });
  }, [trabajadores, marcaciones, asignaciones, hoy]);

  const resumen = useMemo(() => {
    const marcaron = estados.filter((e) => e.entrada !== null).length;
    const faltan = estados.length - marcaron;
    const fueraZona = estados.filter(
      (e) => e.entrada && !e.entrada.dentro_geocerca,
    ).length;
    return { total: estados.length, marcaron, faltan, fueraZona };
  }, [estados]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return estados
      .filter((e) => {
        if (filtro === 'marcaron' && !e.entrada) return false;
        if (filtro === 'faltan' && e.entrada) return false;
        return true;
      })
      .filter((e) => {
        if (!q) return true;
        const full = `${e.trabajador.nombres} ${e.trabajador.apellidos} ${e.trabajador.rut} ${e.trabajador.cargo}`;
        return full.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.entrada && !b.entrada) return -1;
        if (!a.entrada && b.entrada) return 1;
        if (a.entrada && b.entrada) {
          return a.entrada.fecha_hora_servidor.localeCompare(
            b.entrada.fecha_hora_servidor,
          );
        }
        return a.trabajador.apellidos.localeCompare(b.trabajador.apellidos);
      });
  }, [estados, query, filtro]);

  const fechaLegible = useMemo(
    () =>
      new Date().toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <CalendarClock size={22} color={COLORS.primary} />
          <Text style={styles.title}>Asistencia Hoy</Text>
        </View>
        <Text style={styles.subtitle}>{fechaLegible}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
      >
        <View style={styles.metrics}>
          <MetricCard
            icon={<Users size={20} color={COLORS.primary} />}
            num={resumen.total}
            label="Equipo"
            tint={COLORS.primaryLight}
          />
          <MetricCard
            icon={<CheckCircle2 size={20} color={COLORS.success} />}
            num={resumen.marcaron}
            label="Marcaron"
            tint={COLORS.successLight}
          />
          <MetricCard
            icon={<XCircle size={20} color={COLORS.danger} />}
            num={resumen.faltan}
            label="Faltan"
            tint={COLORS.dangerLight}
          />
          <MetricCard
            icon={<AlertTriangle size={20} color={COLORS.warning} />}
            num={resumen.fueraZona}
            label="F. zona"
            tint={COLORS.warningLight}
          />
        </View>

        <View style={styles.filters}>
          {(['todos', 'marcaron', 'faltan'] as Filtro[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filtro === f && styles.filterBtnActive]}
              onPress={() => setFiltro(f)}
              activeOpacity={0.8}
              testID={`filter-${f}`}
            >
              <Text
                style={[
                  styles.filterText,
                  filtro === f && styles.filterTextActive,
                ]}
              >
                {f === 'todos'
                  ? 'Todos'
                  : f === 'marcaron'
                    ? 'Marcaron'
                    : 'Faltan'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar trabajador"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            testID="input-search-asistencia"
          />
        </View>

        {filtrados.length === 0 ? (
          <View style={styles.empty}>
            <Users size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Sin resultados</Text>
          </View>
        ) : (
          filtrados.map((e) => (
            <EstadoCard
              key={e.trabajador.id}
              estado={e}
              puntos={puntos}
              marcacionesTrab={marcaciones.filter(
                (m) => m.trabajador_id === e.trabajador.id,
              )}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EstadoCard({
  estado,
  puntos,
  marcacionesTrab,
}: {
  estado: EstadoTrabajador;
  puntos: PuntoTrabajo[];
  marcacionesTrab: Marcacion[];
}): React.ReactElement {
  const router = useRouter();
  const { trabajador, entrada, ultimaMarcacion, punto } = estado;
  const marcoAlgo = entrada !== null;

  const puntoDetectado = useMemo(() => {
    if (!entrada?.punto_trabajo_id_detectado) return null;
    return (
      puntos.find((p) => p.id === entrada.punto_trabajo_id_detectado) ?? null
    );
  }, [entrada, puntos]);

  const horaEntrada = entrada
    ? new Date(entrada.fecha_hora_servidor).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const distTxt =
    entrada?.distancia_al_punto != null
      ? entrada.distancia_al_punto < 1000
        ? `${Math.round(entrada.distancia_al_punto)} m`
        : `${(entrada.distancia_al_punto / 1000).toFixed(2)} km`
      : null;

  const sector =
    puntoDetectado?.nombre_lugar ??
    entrada?.direccion_aprox ??
    punto?.nombre_lugar ??
    'Sin sector';

  const dentro = entrada?.dentro_geocerca ?? false;

  const hoyKey = new Date().toISOString().slice(0, 10);
  const marcacionesHoy = marcacionesTrab
    .filter((m) => m.fecha_hora_servidor.slice(0, 10) === hoyKey)
    .sort((a, b) =>
      a.fecha_hora_servidor.localeCompare(b.fecha_hora_servidor),
    );

  const abrirDetalle = (id: string) => {
    router.push({ pathname: '/marcacion-detail', params: { id } });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={!entrada}
      onPress={() => entrada && abrirDetalle(entrada.id)}
      style={[
        styles.card,
        marcoAlgo
          ? { borderLeftColor: COLORS.success }
          : { borderLeftColor: COLORS.danger },
      ]}
      testID={`estado-card-${trabajador.id}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {trabajador.nombres[0]}
            {trabajador.apellidos[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {trabajador.nombres} {trabajador.apellidos}
          </Text>
          <Text style={styles.meta}>
            {formatRut(trabajador.rut)} · {trabajador.cargo}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: marcoAlgo
                ? COLORS.successLight
                : COLORS.dangerLight,
            },
          ]}
        >
          {marcoAlgo ? (
            <CheckCircle2 size={12} color={COLORS.success} />
          ) : (
            <XCircle size={12} color={COLORS.danger} />
          )}
          <Text
            style={[
              styles.statusText,
              { color: marcoAlgo ? COLORS.success : COLORS.danger },
            ]}
          >
            {marcoAlgo ? 'Marcó' : 'Falta'}
          </Text>
        </View>
      </View>

      {marcoAlgo ? (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Clock3 size={13} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Entrada</Text>
            <Text style={styles.detailValue}>{horaEntrada}</Text>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={13} color={COLORS.textSecondary} />
            <Text style={styles.detailLabel}>Sector</Text>
            <Text
              style={styles.detailValue}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {sector}
            </Text>
          </View>
          {distTxt && (
            <View style={styles.detailRow}>
              <Navigation size={13} color={COLORS.textSecondary} />
              <Text style={styles.detailLabel}>Distancia</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: dentro ? COLORS.success : COLORS.warning },
                ]}
              >
                {distTxt} {dentro ? '· en zona' : '· fuera zona'}
              </Text>
            </View>
          )}
          {ultimaMarcacion && ultimaMarcacion.id !== entrada?.id && (
            <View style={[styles.detailRow, styles.lastRow]}>
              <Clock3 size={13} color={COLORS.textMuted} />
              <Text style={styles.detailLabel}>Última</Text>
              <Text style={styles.detailValue}>
                {TIPO_MARCACION_LABEL[ultimaMarcacion.tipo_marcacion]} ·{' '}
                {new Date(
                  ultimaMarcacion.fecha_hora_servidor,
                ).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {marcacionesHoy.length > 0 && (
            <View style={styles.markersRow}>
              {marcacionesHoy.map((m) => {
                const hora = new Date(
                  m.fecha_hora_servidor,
                ).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const bg =
                  m.estado_validacion === 'valida'
                    ? COLORS.successLight
                    : m.estado_validacion === 'alerta'
                      ? COLORS.dangerLight
                      : COLORS.warningLight;
                const fg =
                  m.estado_validacion === 'valida'
                    ? COLORS.success
                    : m.estado_validacion === 'alerta'
                      ? COLORS.danger
                      : COLORS.warning;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => abrirDetalle(m.id)}
                    style={[styles.markerChip, { backgroundColor: bg }]}
                    testID={`marker-chip-${m.id}`}
                  >
                    <MapPin size={10} color={fg} />
                    <Text style={[styles.markerText, { color: fg }]}>
                      {TIPO_MARCACION_LABEL[m.tipo_marcacion].split(' ')[0]} ·{' '}
                      {hora}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MapPin size={13} color={COLORS.textMuted} />
            <Text style={styles.detailLabel}>Asignado</Text>
            <Text
              style={styles.detailValue}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {punto?.nombre_lugar ?? 'Sin asignación'}
            </Text>
          </View>
          <Text style={styles.pendingText}>
            Aún no registra entrada hoy
          </Text>
        </View>
      )}
    </TouchableOpacity>
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  scroll: { padding: 16, paddingBottom: 32 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricNum: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  metricLbl: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
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
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  empty: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 22,
    borderRadius: 14,
    gap: 8,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    width: 72,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  lastRow: {
    marginTop: 2,
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  markersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  markerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  markerText: { fontSize: 10, fontWeight: '700' },
});
