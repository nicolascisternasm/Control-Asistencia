import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Pencil,
  Ruler,
  Building2,
} from 'lucide-react-native';
import { COLORS, PuntoTrabajo } from '@/types';
import { repo } from '@/services/repository';

export default function PuntosScreen(): React.ReactElement {
  const router = useRouter();
  const [puntos, setPuntos] = useState<PuntoTrabajo[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const ps = await repo.getPuntosTrabajo();
    setPuntos(ps);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          testID="btn-back"
        >
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Puntos de trabajo</Text>
          <Text style={styles.topSub}>
            {puntos.length} {puntos.length === 1 ? 'ubicación' : 'ubicaciones'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/punto-form')}
          activeOpacity={0.85}
          testID="btn-add-punto"
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        {puntos.length === 0 ? (
          <View style={styles.empty}>
            <MapPin size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin puntos de trabajo</Text>
            <Text style={styles.emptyText}>
              Crea el primer punto para asignárselo a tus trabajadores
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/punto-form')}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Crear punto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          puntos.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/punto-form', params: { id: p.id } })
              }
              activeOpacity={0.7}
              testID={`row-punto-${p.id}`}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: p.activo ? COLORS.primaryLight : COLORS.surfaceAlt },
                ]}
              >
                <Building2
                  size={20}
                  color={p.activo ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.nombre_lugar}
                  </Text>
                  {!p.activo && (
                    <View style={styles.inactiveTag}>
                      <Text style={styles.inactiveText}>Inactivo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <MapPin size={11} color={COLORS.textMuted} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {p.direccion}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ruler size={11} color={COLORS.textMuted} />
                  <Text style={styles.meta}>
                    Radio {p.radio_permitido_metros} m · {p.latitud.toFixed(4)},{' '}
                    {p.longitud.toFixed(4)}
                  </Text>
                </View>
              </View>
              <Pencil size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
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
  topTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  topSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  meta: { fontSize: 12, color: COLORS.textSecondary, flexShrink: 1 },
  inactiveTag: {
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveText: { fontSize: 10, color: COLORS.danger, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 32,
    borderRadius: 18,
    gap: 10,
    marginTop: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 6 },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
