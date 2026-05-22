import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogIn,
  LogOut,
  Coffee,
  Utensils,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Navigation,
  Ban,
  Hourglass,
  X,
  Send,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Alert, Modal, TextInput } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useMarcaciones } from '@/contexts/MarcacionesContext';
import { useToast } from '@/contexts/ToastContext';
import {
  COLORS,
  TIPO_MARCACION_LABEL,
  TipoMarcacion,
  EstadoValidacion,
} from '@/types';

const SECUENCIA: TipoMarcacion[] = [
  'entrada',
  'salida_colacion',
  'regreso_colacion',
  'salida',
];

const ICONOS: Record<TipoMarcacion, React.ComponentType<{ size: number; color: string }>> = {
  entrada: LogIn,
  salida_colacion: Coffee,
  regreso_colacion: Utensils,
  salida: LogOut,
};

const COLORES_TIPO: Record<TipoMarcacion, string> = {
  entrada: COLORS.success,
  salida_colacion: COLORS.warning,
  regreso_colacion: COLORS.accent,
  salida: COLORS.primary,
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatFecha(d: Date): string {
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function DashboardScreen(): React.ReactElement {
  const { trabajador } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const {
    marcaciones,
    puntoAsignado,
    siguiente,
    marcar,
    loading,
    solicitudOmitirHoy,
    colacionAprobadaOmitir,
    solicitarOmitirColacion,
    cancelarSolicitudOmitir,
  } = useMarcaciones();
  const [modalOmitir, setModalOmitir] = useState<boolean>(false);
  const [motivoOmitir, setMotivoOmitir] = useState<string>('');
  const [enviandoOmitir, setEnviandoOmitir] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(new Date());
  const [procesando, setProcesando] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    tipo: 'ok' | 'alerta' | 'error';
    mensaje: string;
  } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const marcacionesHoy = useMemo(
    () => marcaciones.filter((m) => m.fecha_hora_servidor.slice(0, 10) === hoy),
    [marcaciones, hoy],
  );

  const estadoJornada = useMemo<string>(() => {
    if (siguiente === 'entrada') return 'Sin iniciar';
    if (siguiente === 'salida_colacion') return 'En jornada';
    if (siguiente === 'regreso_colacion') return 'En colación';
    if (siguiente === 'salida') return 'Jornada activa';
    return 'Jornada finalizada';
  }, [siguiente]);

  const onMarcar = async (tipo: TipoMarcacion) => {
    setProcesando(true);
    setFeedback(null);
    const res = await marcar(tipo);
    if (!res.ok) {
      setFeedback({ tipo: 'error', mensaje: res.message });
    } else {
      const estado: EstadoValidacion | undefined = res.marcacion?.estado_validacion;
      setFeedback({
        tipo: estado === 'valida' ? 'ok' : 'alerta',
        mensaje: res.message,
      });
    }
    setProcesando(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const nombre = trabajador?.nombres.split(' ')[0] ?? '';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hola,</Text>
              <Text style={styles.name}>{nombre}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{estadoJornada}</Text>
            </View>
          </View>

          <View style={styles.clockBox}>
            <Clock3 size={16} color={COLORS.primaryLight} />
            <Text style={styles.clock}>{formatClock(now)}</Text>
          </View>
          <Text style={styles.date}>{formatFecha(now)}</Text>

          {puntoAsignado ? (
            <View style={styles.locationChip}>
              <MapPin size={14} color="#FFFFFF" />
              <Text style={styles.locationText} numberOfLines={1}>
                {puntoAsignado.nombre_lugar} · radio {puntoAsignado.radio_permitido_metros}m
              </Text>
            </View>
          ) : (
            <View style={styles.locationChip}>
              <MapPin size={14} color="#FFFFFF" />
              <Text style={styles.locationText}>Sin punto de trabajo asignado</Text>
            </View>
          )}
        </View>

        {!!feedback && (
          <View
            style={[
              styles.feedback,
              feedback.tipo === 'ok' && styles.feedbackOk,
              feedback.tipo === 'alerta' && styles.feedbackAlerta,
              feedback.tipo === 'error' && styles.feedbackError,
            ]}
          >
            {feedback.tipo === 'ok' ? (
              <CheckCircle2 size={18} color={COLORS.success} />
            ) : (
              <AlertTriangle
                size={18}
                color={feedback.tipo === 'error' ? COLORS.danger : COLORS.warning}
              />
            )}
            <Text
              style={[
                styles.feedbackText,
                feedback.tipo === 'ok' && { color: COLORS.success },
                feedback.tipo === 'alerta' && { color: COLORS.warning },
                feedback.tipo === 'error' && { color: COLORS.danger },
              ]}
            >
              {feedback.mensaje}
            </Text>
          </View>
        )}

        <View style={styles.colacionBox}>
          <View style={styles.colacionHeader}>
            <View style={styles.colacionIcon}>
              <Coffee size={18} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.colacionTitle}>Colación de hoy</Text>
              <Text style={styles.colacionSub}>
                {colacionAprobadaOmitir
                  ? 'Aprobado omitir · cuenta como hora extra'
                  : solicitudOmitirHoy?.estado === 'pendiente'
                    ? 'Solicitud pendiente de aprobación'
                    : solicitudOmitirHoy?.estado === 'rechazada'
                      ? 'Solicitud rechazada por admin'
                      : 'Si no almorzarás, puedes solicitar omitir'}
              </Text>
            </View>
            {colacionAprobadaOmitir ? (
              <View style={[styles.colacionStatus, { backgroundColor: COLORS.successLight }]}>
                <CheckCircle2 size={14} color={COLORS.success} />
                <Text style={[styles.colacionStatusText, { color: COLORS.success }]}>Aprobado</Text>
              </View>
            ) : solicitudOmitirHoy?.estado === 'pendiente' ? (
              <View style={[styles.colacionStatus, { backgroundColor: COLORS.warningLight }]}>
                <Hourglass size={14} color={COLORS.warning} />
                <Text style={[styles.colacionStatusText, { color: COLORS.warning }]}>Pendiente</Text>
              </View>
            ) : solicitudOmitirHoy?.estado === 'rechazada' ? (
              <View style={[styles.colacionStatus, { backgroundColor: COLORS.dangerLight }]}>
                <X size={14} color={COLORS.danger} />
                <Text style={[styles.colacionStatusText, { color: COLORS.danger }]}>Rechazada</Text>
              </View>
            ) : null}
          </View>
          {!solicitudOmitirHoy && (
            <TouchableOpacity
              style={styles.colacionBtn}
              onPress={() => setModalOmitir(true)}
              activeOpacity={0.85}
              testID="btn-solicitar-omitir"
            >
              <Ban size={16} color={COLORS.warning} />
              <Text style={styles.colacionBtnText}>Solicitar no almorzar hoy</Text>
            </TouchableOpacity>
          )}
          {solicitudOmitirHoy?.estado === 'pendiente' && (
            <TouchableOpacity
              style={[styles.colacionBtn, { backgroundColor: COLORS.dangerLight }]}
              onPress={() => {
                Alert.alert('Cancelar solicitud', '¿Cancelar la solicitud pendiente?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelarSolicitudOmitir() },
                ]);
              }}
              activeOpacity={0.85}
            >
              <X size={16} color={COLORS.danger} />
              <Text style={[styles.colacionBtnText, { color: COLORS.danger }]}>Cancelar solicitud</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.section}>Marcaciones de hoy</Text>
        <View style={styles.grid}>
          {SECUENCIA.map((tipo) => {
            const Icon = ICONOS[tipo];
            const hecha = marcacionesHoy.find((m) => m.tipo_marcacion === tipo);
            const esSiguiente = siguiente === tipo;
            const esColacion = tipo === 'salida_colacion' || tipo === 'regreso_colacion';
            const bloqueadoPorOmitir = colacionAprobadaOmitir && esColacion;
            const disabled = !esSiguiente || procesando || bloqueadoPorOmitir || !!hecha;
            return (
              <TouchableOpacity
                key={tipo}
                testID={`btn-${tipo}`}
                style={[
                  styles.cell,
                  hecha && styles.cellDone,
                  esSiguiente && { borderColor: COLORES_TIPO[tipo], borderWidth: 2 },
                  !esSiguiente && !hecha && { opacity: 0.55 },
                ]}
                onPress={() => onMarcar(tipo)}
                disabled={disabled}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.cellIcon,
                    { backgroundColor: hecha ? COLORS.successLight : COLORES_TIPO[tipo] + '22' },
                  ]}
                >
                  {hecha ? (
                    <CheckCircle2 size={22} color={COLORS.success} />
                  ) : (
                    <Icon size={22} color={COLORES_TIPO[tipo]} />
                  )}
                </View>
                <Text style={styles.cellLabel}>{TIPO_MARCACION_LABEL[tipo]}</Text>
                {hecha ? (
                  <Text style={styles.cellTime}>
                    {formatClock(new Date(hecha.fecha_hora_servidor))}
                  </Text>
                ) : bloqueadoPorOmitir ? (
                  <Text style={[styles.cellTime, { color: COLORS.textMuted }]}>Omitida</Text>
                ) : esSiguiente ? (
                  <Text style={[styles.cellTime, { color: COLORES_TIPO[tipo], fontWeight: '700' }]}>
                    Tocar para marcar
                  </Text>
                ) : (
                  <Text style={[styles.cellTime, { color: COLORS.textMuted }]}>Pendiente</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {siguiente && (
          <TouchableOpacity
            testID="btn-marcar-principal"
            style={[
              styles.mainBtn,
              { backgroundColor: COLORES_TIPO[siguiente] },
              procesando && { opacity: 0.7 },
            ]}
            disabled={procesando}
            onPress={() => onMarcar(siguiente)}
            activeOpacity={0.9}
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Navigation size={22} color="#FFFFFF" />
                <Text style={styles.mainBtnText}>
                  Marcar {TIPO_MARCACION_LABEL[siguiente].toLowerCase()}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!siguiente && (
          <View style={styles.finishedCard}>
            <CheckCircle2 size={32} color={COLORS.success} />
            <Text style={styles.finishedTitle}>Jornada completa</Text>
            <Text style={styles.finishedText}>
              Registraste todas las marcaciones de hoy. ¡Buen trabajo!
            </Text>
          </View>
        )}

        <Text style={styles.section}>Actividad reciente</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
        ) : marcaciones.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Aún no registras marcaciones. Cuando marques tu entrada la verás aquí.
            </Text>
          </View>
        ) : (
          marcaciones.slice(0, 5).map((m) => {
            const Icon = ICONOS[m.tipo_marcacion];
            const d = new Date(m.fecha_hora_servidor);
            return (
              <TouchableOpacity
                key={m.id}
                style={styles.activityRow}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/marcacion-detail',
                    params: { id: m.id },
                  })
                }
                testID={`activity-row-${m.id}`}
              >
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: COLORES_TIPO[m.tipo_marcacion] + '22' },
                  ]}
                >
                  <Icon size={18} color={COLORES_TIPO[m.tipo_marcacion]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>
                    {TIPO_MARCACION_LABEL[m.tipo_marcacion]}
                  </Text>
                  <Text style={styles.activityMeta}>
                    {d.toLocaleDateString('es-CL')} · {formatClock(d)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.stateTag,
                    m.estado_validacion === 'valida' && { backgroundColor: COLORS.successLight },
                    m.estado_validacion === 'alerta' && { backgroundColor: COLORS.dangerLight },
                    m.estado_validacion === 'pendiente_revision' && {
                      backgroundColor: COLORS.warningLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stateText,
                      m.estado_validacion === 'valida' && { color: COLORS.success },
                      m.estado_validacion === 'alerta' && { color: COLORS.danger },
                      m.estado_validacion === 'pendiente_revision' && { color: COLORS.warning },
                    ]}
                  >
                    {m.estado_validacion === 'valida'
                      ? 'OK'
                      : m.estado_validacion === 'alerta'
                        ? 'Alerta'
                        : 'Revisar'}
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })
        )}

        {Platform.OS === 'web' && (
          <Text style={styles.webNotice}>
            En web la geolocalización puede requerir permiso del navegador.
          </Text>
        )}
      </ScrollView>

      <Modal
        visible={modalOmitir}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOmitir(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.colacionIcon}>
                <Ban size={18} color={COLORS.warning} />
              </View>
              <Text style={styles.modalTitle}>No almorzar hoy</Text>
            </View>
            <Text style={styles.modalDesc}>
              La colación contará como hora extra si sales a la hora de salida registrada.
              Debe aprobarlo el administrador.
            </Text>
            <Text style={styles.modalLabel}>Motivo</Text>
            <TextInput
              value={motivoOmitir}
              onChangeText={setMotivoOmitir}
              placeholder="Ej: quiero salir a la hora registrada"
              placeholderTextColor={COLORS.textMuted}
              style={styles.modalInput}
              multiline
              testID="input-motivo-omitir"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSec]}
                onPress={() => {
                  setModalOmitir(false);
                  setMotivoOmitir('');
                }}
                disabled={enviandoOmitir}
              >
                <Text style={styles.modalBtnSecText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, enviandoOmitir && { opacity: 0.6 }]}
                onPress={async () => {
                  if (motivoOmitir.trim().length < 3) {
                    showToast('Indica un motivo más descriptivo', 'error');
                    return;
                  }
                  setEnviandoOmitir(true);
                  const res = await solicitarOmitirColacion(motivoOmitir);
                  setEnviandoOmitir(false);
                  if (res.ok) {
                    setModalOmitir(false);
                    setMotivoOmitir('');
                    setFeedback({ tipo: 'ok', mensaje: res.message });
                    setTimeout(() => setFeedback(null), 3500);
                  } else {
                    showToast(res.message, 'error');
                  }
                }}
                disabled={enviandoOmitir}
                testID="btn-enviar-omitir"
              >
                {enviandoOmitir ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={14} color="#FFFFFF" />
                    <Text style={styles.modalBtnPrimaryText}>Enviar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 22,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: { color: '#C7D2FE', fontSize: 13, fontWeight: '500' },
  name: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  clockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  clock: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  date: {
    color: '#C7D2FE',
    fontSize: 13,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  locationText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  feedbackOk: { backgroundColor: COLORS.successLight },
  feedbackAlerta: { backgroundColor: COLORS.warningLight },
  feedbackError: { backgroundColor: COLORS.dangerLight },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: '600' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cellDone: { backgroundColor: COLORS.successLight, borderColor: COLORS.successLight },
  cellIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cellLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cellTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  mainBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    height: 60,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  mainBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  finishedCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  },
  finishedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 8,
  },
  finishedText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  activityMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  stateTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateText: { fontSize: 11, fontWeight: '700' },
  webNotice: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  colacionBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  colacionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colacionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colacionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  colacionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  colacionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  colacionStatusText: { fontSize: 11, fontWeight: '700' },
  colacionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: COLORS.warningLight,
    paddingVertical: 10,
    borderRadius: 10,
  },
  colacionBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 10, lineHeight: 18 },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  modalInput: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: 'top',
    backgroundColor: COLORS.surfaceAlt,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalBtnSec: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnSecText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
