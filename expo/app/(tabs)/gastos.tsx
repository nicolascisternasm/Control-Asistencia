import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Receipt,
  Filter,
  CheckCircle2,
  Clock3,
  XCircle,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  COLORS,
  Gasto,
  CATEGORIA_GASTO_LABEL,
  EstadoGasto,
} from '@/types';
import { useGastos } from '@/contexts/GastosContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

type Filtro = 'todos' | EstadoGasto;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'rechazado', label: 'Rechazados' },
];

function formatCLP(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function GastosScreen(): React.ReactElement {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const { gastos, refetch, totalMes, updateEstado, remove } = useGastos();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const filtrados = useMemo<Gasto[]>(() => {
    if (filtro === 'todos') return gastos;
    return gastos.filter((g) => g.estado === filtro);
  }, [gastos, filtro]);

  const counts = useMemo(() => {
    return {
      pendiente: gastos.filter((g) => g.estado === 'pendiente').length,
      aprobado: gastos.filter((g) => g.estado === 'aprobado').length,
      rechazado: gastos.filter((g) => g.estado === 'rechazado').length,
    };
  }, [gastos]);

  const handleAprobar = useCallback(
    (g: Gasto) => {
      Alert.alert('Aprobar gasto', `${g.comercio} · ${formatCLP(g.monto)}`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            await updateEstado({ id: g.id, estado: 'aprobado' });
            showToast(`Gasto aprobado: ${formatCLP(g.monto)}`, 'success');
          },
        },
      ]);
    },
    [updateEstado, showToast],
  );

  const handleRechazar = useCallback(
    (g: Gasto) => {
      Alert.alert('Rechazar gasto', `${g.comercio} · ${formatCLP(g.monto)}`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            await updateEstado({ id: g.id, estado: 'rechazado' });
            showToast('Gasto rechazado', 'info');
          },
        },
      ]);
    },
    [updateEstado, showToast],
  );

  const handleEliminar = useCallback(
    (g: Gasto) => {
      Alert.alert('Eliminar gasto', '¿Eliminar este registro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await remove(g.id);
            showToast('Gasto eliminado', 'info');
          },
        },
      ]);
    },
    [remove, showToast],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gastos</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Gastos de todo el equipo' : 'Tus gastos con tarjeta'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/gasto-form')}
          activeOpacity={0.85}
          testID="btn-nuevo-gasto"
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            <Wallet size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Total mes actual</Text>
            <Text style={styles.summaryValue}>{formatCLP(totalMes)}</Text>
          </View>
          <View style={styles.summaryBadge}>
            <TrendingUp size={12} color="#FFFFFF" />
            <Text style={styles.summaryBadgeText}>{gastos.length} gastos</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon={<Clock3 size={18} color={COLORS.warning} />}
            num={counts.pendiente}
            label="Pendientes"
            tint={COLORS.warningLight}
          />
          <StatCard
            icon={<CheckCircle2 size={18} color={COLORS.success} />}
            num={counts.aprobado}
            label="Aprobados"
            tint={COLORS.successLight}
          />
          <StatCard
            icon={<XCircle size={18} color={COLORS.danger} />}
            num={counts.rechazado}
            label="Rechazados"
            tint={COLORS.dangerLight}
          />
        </View>

        <View style={styles.filtersRow}>
          <Filter size={14} color={COLORS.textSecondary} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {FILTROS.map((f) => {
              const active = filtro === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFiltro(f.id)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {filtrados.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Receipt size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Sin gastos registrados</Text>
            <Text style={styles.emptyText}>
              Toca &quot;Nuevo&quot; para registrar tu primer gasto con foto de boleta.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/gasto-form')}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Registrar gasto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtrados.map((g) => (
            <View key={g.id} style={styles.gastoCard}>
              <View style={styles.gastoTop}>
                {g.foto_url ? (
                  <Image source={{ uri: g.foto_url }} style={styles.gastoImg} />
                ) : (
                  <View style={[styles.gastoImg, styles.gastoImgEmpty]}>
                    <Receipt size={22} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.gastoHeadRow}>
                    <Text style={styles.gastoMonto}>{formatCLP(g.monto)}</Text>
                    <EstadoPill estado={g.estado} />
                  </View>
                  <Text style={styles.gastoComercio} numberOfLines={1}>
                    {g.comercio}
                  </Text>
                  <Text style={styles.gastoMeta}>
                    {CATEGORIA_GASTO_LABEL[g.categoria]} · {g.fecha_gasto}
                  </Text>
                  {isAdmin && (
                    <Text style={styles.gastoTrab} numberOfLines={1}>
                      {g.trabajador_nombre}
                    </Text>
                  )}
                </View>
              </View>

              {!!g.descripcion && (
                <Text style={styles.gastoDesc} numberOfLines={2}>
                  {g.descripcion}
                </Text>
              )}

              {isAdmin && g.estado === 'pendiente' ? (
                <View style={styles.adminActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionApprove]}
                    onPress={() => handleAprobar(g)}
                    activeOpacity={0.85}
                  >
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text style={styles.actionText}>Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionReject]}
                    onPress={() => handleRechazar(g)}
                    activeOpacity={0.85}
                  >
                    <XCircle size={14} color={COLORS.danger} />
                    <Text style={[styles.actionText, { color: COLORS.danger }]}>
                      Rechazar
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : g.estado === 'pendiente' ? (
                <TouchableOpacity
                  style={styles.deleteLink}
                  onPress={() => handleEliminar(g)}
                >
                  <Text style={styles.deleteLinkText}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EstadoPill({ estado }: { estado: EstadoGasto }): React.ReactElement {
  const cfg = {
    pendiente: { bg: COLORS.warningLight, color: COLORS.warning, label: 'Pendiente' },
    aprobado: { bg: COLORS.successLight, color: COLORS.success, label: 'Aprobado' },
    rechazado: { bg: COLORS.dangerLight, color: COLORS.danger, label: 'Rechazado' },
  }[estado];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StatCard({
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
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 12,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: { color: '#C7D2FE', fontSize: 12, fontWeight: '600' },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  summaryBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  empty: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 12,
    marginTop: 14,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  gastoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  gastoTop: { flexDirection: 'row', gap: 12 },
  gastoImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  gastoImgEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gastoHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gastoMonto: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  gastoComercio: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  gastoMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  gastoTrab: { fontSize: 11, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  gastoDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 10,
    lineHeight: 17,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  adminActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
  },
  actionApprove: { backgroundColor: COLORS.success },
  actionReject: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  deleteLink: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  deleteLinkText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
});
