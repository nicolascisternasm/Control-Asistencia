import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
// react-native-maps reemplazado temporalmente por stub de diagnóstico
const PROVIDER_DEFAULT = null;
const MapView = ({ style, children }: { style?: any; children?: React.ReactNode }) => (
  <View style={[style, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600' }}>Mapa no disponible</Text>
  </View>
);
const Marker = (_props: any) => null;
const Circle = (_props: any) => null;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  MapPin,
  X,
  Clock3,
  Navigation,
  Target,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Crosshair,
  User as UserIcon,
} from 'lucide-react-native';
import {
  COLORS,
  Marcacion,
  PuntoTrabajo,
  TIPO_MARCACION_LABEL,
  Trabajador,
} from '@/types';
import { repo } from '@/services/repository';
import {
  buildMapsUrl,
  formatDistancia,
  haversineMeters,
  reverseGeocode,
} from '@/utils/geo';
import { formatRut } from '@/utils/rut';
import * as Clipboard from 'expo-clipboard';

export default function MarcacionDetailScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const [marcacion, setMarcacion] = useState<Marcacion | null>(null);
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [puntoDetectado, setPuntoDetectado] = useState<PuntoTrabajo | null>(
    null,
  );
  const [puntoAsignado, setPuntoAsignado] = useState<PuntoTrabajo | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);
  const [loadingAddr, setLoadingAddr] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      const all = await repo.getMarcaciones();
      const m = all.find((x) => x.id === params.id) ?? null;
      if (!m) return;
      setMarcacion(m);
      const t = await repo.getTrabajadorById(m.trabajador_id);
      setTrabajador(t);
      const puntos = await repo.getPuntosTrabajo();
      const det = m.punto_trabajo_id_detectado
        ? puntos.find((p) => p.id === m.punto_trabajo_id_detectado) ?? null
        : null;
      setPuntoDetectado(det);
      const asig = await repo.getPuntoAsignado(m.trabajador_id);
      setPuntoAsignado(asig);

      if (m.direccion_aprox && m.direccion_aprox.length > 0) {
        setDireccion(m.direccion_aprox);
      } else if (m.latitud != null && m.longitud != null) {
        setLoadingAddr(true);
        const addr = await reverseGeocode(m.latitud, m.longitud);
        setDireccion(addr);
        setLoadingAddr(false);
      }
    })();
  }, [params.id]);

  const distanciaReal = useMemo<number | null>(() => {
    if (!marcacion || marcacion.latitud == null || marcacion.longitud == null)
      return null;
    const ref = puntoAsignado ?? puntoDetectado;
    if (!ref) return marcacion.distancia_al_punto ?? null;
    return haversineMeters(
      marcacion.latitud,
      marcacion.longitud,
      ref.latitud,
      ref.longitud,
    );
  }, [marcacion, puntoAsignado, puntoDetectado]);



  const abrirEnMapas = async () => {
    if (!marcacion || marcacion.latitud == null || marcacion.longitud == null)
      return;
    const url = buildMapsUrl(marcacion.latitud, marcacion.longitud);
    await Linking.openURL(url);
  };

  const copiarCoords = async () => {
    if (!marcacion || marcacion.latitud == null || marcacion.longitud == null)
      return;
    await Clipboard.setStringAsync(
      `${marcacion.latitud.toFixed(6)}, ${marcacion.longitud.toFixed(6)}`,
    );
  };

  if (!marcacion) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const fh = new Date(marcacion.fecha_hora_servidor);
  const ref = puntoAsignado ?? puntoDetectado;
  const dentro = marcacion.dentro_geocerca;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          testID="btn-close-detail"
        >
          <X size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Detalle de marcación</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroTag}>
          <View
            style={[
              styles.tipoDot,
              {
                backgroundColor:
                  marcacion.estado_validacion === 'valida'
                    ? COLORS.success
                    : marcacion.estado_validacion === 'alerta'
                      ? COLORS.danger
                      : COLORS.warning,
              },
            ]}
          />
          <Text style={styles.tipoText}>
            {TIPO_MARCACION_LABEL[marcacion.tipo_marcacion]}
          </Text>
        </View>

        <Text style={styles.hora}>
          {fh.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </Text>
        <Text style={styles.fecha}>
          {fh.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        {trabajador && (
          <View style={styles.trabCard}>
            <View style={styles.avatar}>
              <UserIcon size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trabName}>
                {trabajador.nombres} {trabajador.apellidos}
              </Text>
              <Text style={styles.trabMeta}>
                {formatRut(trabajador.rut)} · {trabajador.cargo}
              </Text>
            </View>
          </View>
        )}

        {marcacion.latitud != null && marcacion.longitud != null && (
          <View style={styles.mapWrap} testID="map-preview">
            <MapView
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              initialRegion={{
                latitude: marcacion.latitud,
                longitude: marcacion.longitud,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              pointerEvents="none"
            >
              <Marker
                coordinate={{
                  latitude: marcacion.latitud,
                  longitude: marcacion.longitud,
                }}
                title="Marcación"
                pinColor={COLORS.primary}
              />
              {ref && (
                <>
                  <Marker
                    coordinate={{
                      latitude: ref.latitud,
                      longitude: ref.longitud,
                    }}
                    title={ref.nombre_lugar}
                    description={ref.direccion}
                    pinColor={COLORS.accent}
                  />
                  <Circle
                    center={{
                      latitude: ref.latitud,
                      longitude: ref.longitud,
                    }}
                    radius={ref.radio_permitido_metros}
                    strokeColor={COLORS.accent}
                    fillColor="rgba(14,165,233,0.15)"
                    strokeWidth={2}
                  />
                </>
              )}
            </MapView>
            <TouchableOpacity
              onPress={abrirEnMapas}
              activeOpacity={0.9}
              style={styles.mapOverlay}
              testID="btn-map-overlay"
            >
              <ExternalLink size={14} color="#FFFFFF" />
              <Text style={styles.mapOverlayText}>
                {Platform.OS === 'ios' ? 'Apple Maps' : 'Google Maps'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.statusCard,
            dentro
              ? { backgroundColor: COLORS.successLight }
              : { backgroundColor: COLORS.warningLight },
          ]}
        >
          {dentro ? (
            <CheckCircle2 size={18} color={COLORS.success} />
          ) : (
            <AlertTriangle size={18} color={COLORS.warning} />
          )}
          <Text
            style={[
              styles.statusText,
              { color: dentro ? COLORS.success : COLORS.warning },
            ]}
          >
            {dentro
              ? 'Marcó dentro de la zona permitida'
              : 'Marcó fuera de la zona permitida'}
          </Text>
        </View>

        <Text style={styles.section}>Ubicación registrada</Text>

        <View style={styles.infoCard}>
          <InfoRow
            icon={<MapPin size={16} color={COLORS.primary} />}
            label="Dirección"
            value={
              loadingAddr
                ? 'Obteniendo…'
                : direccion ?? marcacion.direccion_aprox ?? 'No disponible'
            }
          />
          <Divider />
          <InfoRow
            icon={<Crosshair size={16} color={COLORS.primary} />}
            label="Coordenadas"
            value={
              marcacion.latitud != null && marcacion.longitud != null
                ? `${marcacion.latitud.toFixed(6)}, ${marcacion.longitud.toFixed(6)}`
                : 'Sin registro'
            }
            actionIcon={<Copy size={15} color={COLORS.textSecondary} />}
            onAction={copiarCoords}
          />
          <Divider />
          <InfoRow
            icon={<Target size={16} color={COLORS.primary} />}
            label="Precisión GPS"
            value={
              marcacion.precision_metros != null
                ? `± ${Math.round(marcacion.precision_metros)} m`
                : 'No disponible'
            }
          />
          <Divider />
          <InfoRow
            icon={<Clock3 size={16} color={COLORS.primary} />}
            label="Hora servidor"
            value={fh.toLocaleString('es-CL')}
          />
        </View>

        <Text style={styles.section}>Punto de trabajo</Text>
        <View style={styles.infoCard}>
          <InfoRow
            icon={<Building2 size={16} color={COLORS.accent} />}
            label="Lugar"
            value={ref?.nombre_lugar ?? 'Sin punto asignado'}
          />
          <Divider />
          <InfoRow
            icon={<MapPin size={16} color={COLORS.accent} />}
            label="Dirección"
            value={ref?.direccion ?? '—'}
          />
          <Divider />
          <InfoRow
            icon={<Navigation size={16} color={COLORS.accent} />}
            label="Distancia a la obra"
            value={formatDistancia(distanciaReal)}
            valueColor={dentro ? COLORS.success : COLORS.warning}
          />
          <Divider />
          <InfoRow
            icon={<Target size={16} color={COLORS.accent} />}
            label="Radio permitido"
            value={
              ref?.radio_permitido_metros
                ? `${ref.radio_permitido_metros} m`
                : '—'
            }
          />
        </View>

        {!!marcacion.observacion && (
          <>
            <Text style={styles.section}>Observación</Text>
            <View style={styles.obsCard}>
              <AlertTriangle size={16} color={COLORS.warning} />
              <Text style={styles.obsText}>{marcacion.observacion}</Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={abrirEnMapas}
          activeOpacity={0.9}
          testID="btn-open-maps"
        >
          <Navigation size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>
            {Platform.OS === 'ios' ? 'Abrir en Apple Maps' : 'Abrir en Google Maps'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  actionIcon,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text
          style={[styles.rowValue, valueColor ? { color: valueColor } : null]}
        >
          {value}
        </Text>
      </View>
      {actionIcon && (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={10}
          style={styles.rowAction}
        >
          {actionIcon}
        </TouchableOpacity>
      )}
    </View>
  );
}

function Divider(): React.ReactElement {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 40 },
  heroTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipoDot: { width: 8, height: 8, borderRadius: 4 },
  tipoText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  hora: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 10,
    letterSpacing: -1,
  },
  fecha: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  trabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trabName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  trabMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  mapWrap: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    height: 200,
  },
  map: { width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  mapOverlayText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  statusText: { fontSize: 13, fontWeight: '700', flex: 1 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  rowValue: { fontSize: 13, color: COLORS.text, fontWeight: '600', marginTop: 2 },
  rowAction: { padding: 6 },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 58 },
  obsCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.warningLight,
  },
  obsText: { flex: 1, fontSize: 13, color: COLORS.warning, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    marginTop: 24,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
