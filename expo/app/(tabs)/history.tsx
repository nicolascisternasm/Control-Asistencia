import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMarcaciones } from '@/contexts/MarcacionesContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, TIPO_MARCACION_LABEL, TipoMarcacion } from '@/types';
import { resumenMes, formatMinutos } from '@/utils/horas';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type FiltroTipo = 'todos' | TipoMarcacion;

export default function HistoryScreen(): React.ReactElement {
  const { marcaciones, recargar, loading } = useMarcaciones();
  const { trabajador } = useAuth();
  const router = useRouter();
  const [mes, setMes] = useState<Date>(new Date());
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');

  const horasMes = useMemo(
    () => resumenMes(marcaciones, mes.getFullYear(), mes.getMonth(), trabajador?.horario),
    [marcaciones, mes, trabajador],
  );

  const delMes = useMemo(() => {
    return marcaciones.filter((m) => {
      const d = new Date(m.fecha_hora_servidor);
      return (
        d.getMonth() === mes.getMonth() &&
        d.getFullYear() === mes.getFullYear() &&
        (filtro === 'todos' || m.tipo_marcacion === filtro)
      );
    });
  }, [marcaciones, mes, filtro]);

  const agrupado = useMemo(() => {
    const map = new Map<string, typeof marcaciones>();
    for (const m of delMes) {
      const key = m.fecha_hora_servidor.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [delMes]);

  const stats = useMemo(() => {
    const total = delMes.length;
    const alertas = delMes.filter((m) => m.estado_validacion === 'alerta').length;
    const revisar = delMes.filter((m) => m.estado_validacion === 'pendiente_revision').length;
    const ok = delMes.filter((m) => m.estado_validacion === 'valida').length;
    return { total, alertas, revisar, ok };
  }, [delMes]);

  const cambiarMes = (delta: number) => {
    const n = new Date(mes);
    n.setMonth(n.getMonth() + delta);
    setMes(n);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.subtitle}>Todas tus marcaciones en un solo lugar</Text>
      </View>

      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => cambiarMes(-1)} style={styles.monthBtn}>
          <ChevronLeft size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Calendar size={16} color={COLORS.primary} />
          <Text style={styles.monthText}>
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => cambiarMes(1)} style={styles.monthBtn}>
          <ChevronRight size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{stats.ok}</Text>
          <Text style={styles.statLbl}>Válidas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.revisar}</Text>
          <Text style={styles.statLbl}>Revisar</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.danger }]}>{stats.alertas}</Text>
          <Text style={styles.statLbl}>Alertas</Text>
        </View>
      </View>

      <View style={styles.horasBox}>
        <View style={styles.horasCell}>
          <Text style={styles.horasLbl}>Trabajado</Text>
          <Text style={styles.horasNum}>{formatMinutos(horasMes.totalTrabajado)}</Text>
        </View>
        <View style={styles.horasSep} />
        <View style={styles.horasCell}>
          <Text style={styles.horasLbl}>Horas extra</Text>
          <Text style={[styles.horasNum, { color: COLORS.success }]}>
            {formatMinutos(horasMes.totalExtra)}
          </Text>
        </View>
        <View style={styles.horasSep} />
        <View style={styles.horasCell}>
          <Text style={styles.horasLbl}>Atrasos</Text>
          <Text style={[styles.horasNum, { color: COLORS.warning }]}>
            {formatMinutos(horasMes.totalAtraso)}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {(['todos', 'entrada', 'salida_colacion', 'regreso_colacion', 'salida'] as FiltroTipo[]).map(
          (f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filtro === f && styles.chipActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.chipText, filtro === f && styles.chipTextActive]}>
                {f === 'todos' ? 'Todas' : TIPO_MARCACION_LABEL[f]}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
      >
        {agrupado.length === 0 ? (
          <View style={styles.empty}>
            <Calendar size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin registros</Text>
            <Text style={styles.emptyText}>
              No hay marcaciones en este mes con el filtro seleccionado.
            </Text>
          </View>
        ) : (
          agrupado.map(([fecha, items]) => {
            const d = new Date(fecha);
            return (
              <View key={fecha} style={{ marginBottom: 20 }}>
                <Text style={styles.groupDate}>
                  {d.toLocaleDateString('es-CL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                {items
                  .slice()
                  .sort((a, b) => a.fecha_hora_servidor.localeCompare(b.fecha_hora_servidor))
                  .map((m) => {
                    const fh = new Date(m.fecha_hora_servidor);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.row}
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push({
                            pathname: '/marcacion-detail',
                            params: { id: m.id },
                          })
                        }
                        testID={`history-row-${m.id}`}
                      >
                        <View style={styles.timeCol}>
                          <Clock3 size={14} color={COLORS.textMuted} />
                          <Text style={styles.timeText}>
                            {fh.toLocaleTimeString('es-CL', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>
                            {TIPO_MARCACION_LABEL[m.tipo_marcacion]}
                          </Text>
                          {m.latitud !== null && m.longitud !== null && (
                            <View style={styles.geoLine}>
                              <MapPin size={11} color={COLORS.textMuted} />
                              <Text style={styles.geoText} numberOfLines={1}>
                                {m.distancia_al_punto !== null
                                  ? `${Math.round(m.distancia_al_punto)}m del punto`
                                  : `${m.latitud.toFixed(4)}, ${m.longitud.toFixed(4)}`}
                              </Text>
                            </View>
                          )}
                          {!!m.observacion && (
                            <Text style={styles.obs}>{m.observacion}</Text>
                          )}
                        </View>
                        <View
                          style={[
                            styles.badge,
                            m.estado_validacion === 'valida' && {
                              backgroundColor: COLORS.successLight,
                            },
                            m.estado_validacion === 'alerta' && {
                              backgroundColor: COLORS.dangerLight,
                            },
                            m.estado_validacion === 'pendiente_revision' && {
                              backgroundColor: COLORS.warningLight,
                            },
                          ]}
                        >
                          {m.estado_validacion === 'valida' ? (
                            <CheckCircle2 size={14} color={COLORS.success} />
                          ) : (
                            <AlertTriangle
                              size={14}
                              color={
                                m.estado_validacion === 'alerta'
                                  ? COLORS.danger
                                  : COLORS.warning
                              }
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNum: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  horasBox: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  horasCell: { flex: 1, alignItems: 'center' },
  horasSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  horasLbl: { fontSize: 11, color: '#C7D2FE', fontWeight: '600' },
  horasNum: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },
  filters: { paddingHorizontal: 16, gap: 8, paddingTop: 12, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  groupDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  timeCol: { alignItems: 'center', gap: 2, width: 56 },
  timeText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  geoLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  geoText: { fontSize: 11, color: COLORS.textMuted, flexShrink: 1 },
  obs: { fontSize: 11, color: COLORS.warning, marginTop: 3 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
