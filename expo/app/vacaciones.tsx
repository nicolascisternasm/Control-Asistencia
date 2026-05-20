import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Plane,
  Hourglass,
  CheckCircle2,
  X,
  Calendar,
  Trash2,
} from 'lucide-react-native';
import { COLORS, SolicitudVacaciones } from '@/types';
import { useVacaciones } from '@/contexts/VacacionesContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatFechaLarga } from '@/utils/fecha';

function estadoColor(e: SolicitudVacaciones['estado']): {
  bg: string;
  fg: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
} {
  if (e === 'aprobada') {
    return { bg: COLORS.successLight, fg: COLORS.success, label: 'Aprobada', Icon: CheckCircle2 };
  }
  if (e === 'rechazada') {
    return { bg: COLORS.dangerLight, fg: COLORS.danger, label: 'Rechazada', Icon: X };
  }
  return { bg: COLORS.warningLight, fg: COLORS.warning, label: 'Pendiente', Icon: Hourglass };
}

export default function VacacionesScreen(): React.ReactElement {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { solicitudes, loading, recargar, resolver, cancelar } = useVacaciones();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const pendientes = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente'),
    [solicitudes],
  );
  const resueltas = useMemo(
    () => solicitudes.filter((s) => s.estado !== 'pendiente'),
    [solicitudes],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await recargar();
    setRefreshing(false);
  };

  const onResolver = (s: SolicitudVacaciones, accion: 'aprobada' | 'rechazada') => {
    Alert.alert(
      accion === 'aprobada' ? 'Aprobar vacaciones' : 'Rechazar vacaciones',
      `${s.trabajador_nombre}\n${formatFechaLarga(s.fecha_desde)} → ${formatFechaLarga(s.fecha_hasta)}\n${s.dias_habiles} día(s) hábil(es)`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => resolver(s.id, accion),
        },
      ],
    );
  };

  const onCancelar = (s: SolicitudVacaciones) => {
    Alert.alert('Cancelar solicitud', '¿Cancelar esta solicitud pendiente?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: 'destructive', onPress: () => cancelar(s.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Vacaciones</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Gestión de solicitudes del equipo' : 'Tus solicitudes'}
          </Text>
        </View>
        {!isAdmin && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/vacacion-form')}
            testID="btn-nueva-vacacion"
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && solicitudes.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : (
          <>
            {pendientes.length > 0 && (
              <>
                <Text style={styles.section}>Pendientes ({pendientes.length})</Text>
                {pendientes.map((s) => (
                  <Card
                    key={s.id}
                    s={s}
                    isAdmin={isAdmin}
                    onResolver={onResolver}
                    onCancelar={onCancelar}
                  />
                ))}
              </>
            )}

            {resueltas.length > 0 && (
              <>
                <Text style={styles.section}>Historial</Text>
                {resueltas.map((s) => (
                  <Card key={s.id} s={s} isAdmin={isAdmin} />
                ))}
              </>
            )}

            {solicitudes.length === 0 && (
              <View style={styles.empty}>
                <Plane size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Sin solicitudes</Text>
                <Text style={styles.emptyText}>
                  {isAdmin
                    ? 'Cuando los trabajadores soliciten vacaciones aparecerán aquí.'
                    : 'Toca el botón + para crear tu primera solicitud de vacaciones.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  s,
  isAdmin,
  onResolver,
  onCancelar,
}: {
  s: SolicitudVacaciones;
  isAdmin: boolean;
  onResolver?: (s: SolicitudVacaciones, accion: 'aprobada' | 'rechazada') => void;
  onCancelar?: (s: SolicitudVacaciones) => void;
}): React.ReactElement {
  const { bg, fg, label, Icon } = estadoColor(s.estado);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}>
          <Plane size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          {isAdmin && (
            <Text style={styles.cardName}>{s.trabajador_nombre}</Text>
          )}
          <View style={styles.rangeRow}>
            <Calendar size={13} color={COLORS.textSecondary} />
            <Text style={styles.range}>
              {formatFechaLarga(s.fecha_desde)} → {formatFechaLarga(s.fecha_hasta)}
            </Text>
          </View>
          <Text style={styles.days}>{s.dias_habiles} día(s) hábil(es)</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: bg }]}>
          <Icon size={12} color={fg} />
          <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
        </View>
      </View>

      {!!s.motivo && <Text style={styles.motivo}>“{s.motivo}”</Text>}

      {isAdmin && s.estado === 'pendiente' && onResolver && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
            onPress={() => onResolver(s, 'aprobada')}
            testID={`btn-aprobar-vac-${s.id}`}
          >
            <Text style={styles.actionText}>Aprobar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionSec]}
            onPress={() => onResolver(s, 'rechazada')}
          >
            <Text style={[styles.actionText, { color: COLORS.textSecondary }]}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAdmin && s.estado === 'pendiente' && onCancelar && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onCancelar(s)}
          testID={`btn-cancelar-vac-${s.id}`}
        >
          <Trash2 size={14} color={COLORS.danger} />
          <Text style={styles.cancelText}>Cancelar solicitud</Text>
        </TouchableOpacity>
      )}
    </View>
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  cardName: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  range: { fontSize: 13, color: COLORS.text, fontWeight: '600', flex: 1 },
  days: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  motivo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 10, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  actionSec: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12,
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 10, borderRadius: 10,
  },
  cancelText: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 32, borderRadius: 16,
    gap: 10, marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
