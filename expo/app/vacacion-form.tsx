import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle2,
  Plane,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS } from '@/types';
import {
  useVacaciones,
  validarSolicitudVacaciones,
  MIN_DIAS_ANTICIPACION,
} from '@/contexts/VacacionesContext';
import { formatFechaLarga, parseFecha, startOfDay, toISODate } from '@/utils/fecha';

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function VacacionFormScreen(): React.ReactElement {
  const router = useRouter();
  const { crear } = useVacaciones();

  const hoy = useMemo(() => startOfDay(new Date()), []);
  const sugerida = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 10);
    return toISODate(d);
  }, [hoy]);

  const [desde, setDesde] = useState<string>(sugerida);
  const [hasta, setHasta] = useState<string>(sugerida);
  const [motivo, setMotivo] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = parseFecha(sugerida) ?? new Date(hoy);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const validacion = useMemo(
    () => validarSolicitudVacaciones(desde, hasta, hoy),
    [desde, hasta, hoy],
  );

  const onSelectDay = (iso: string) => {
    const d = parseFecha(iso);
    if (!d) return;
    // Si no hay rango (desde == hasta) o se completó uno, esta selección
    // se convierte en nuevo "desde". Si ya hay un "desde" sin "hasta", se
    // elige "hasta".
    const desdeDate = parseFecha(desde);
    const hastaDate = parseFecha(hasta);
    if (!desdeDate || (desdeDate && hastaDate && desde !== hasta)) {
      setDesde(iso);
      setHasta(iso);
      return;
    }
    if (desde === hasta) {
      if (d < desdeDate) {
        setDesde(iso);
        setHasta(desde);
      } else {
        setHasta(iso);
      }
      return;
    }
    setDesde(iso);
    setHasta(iso);
  };

  const onEnviar = async () => {
    if (!validacion.ok) {
      Alert.alert('Solicitud inválida', validacion.message);
      return;
    }
    setEnviando(true);
    const res = await crear(desde, hasta, motivo);
    setEnviando(false);
    if (res.ok) {
      Alert.alert('Éxito', res.message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', res.message);
    }
  };

  const prevMonth = () => {
    setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.back}
            testID="btn-back"
          >
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Solicitar vacaciones</Text>
            <Text style={styles.subtitle}>
              Requiere {MIN_DIAS_ANTICIPACION} días hábiles de anticipación
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Plane size={20} color={COLORS.primary} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.rangeRow}>
            <View style={styles.rangeBox}>
              <Text style={styles.rangeLbl}>Desde</Text>
              <Text style={styles.rangeVal}>{formatFechaLarga(desde)}</Text>
            </View>
            <View style={styles.rangeArrow}><ChevronRight size={18} color={COLORS.textMuted} /></View>
            <View style={styles.rangeBox}>
              <Text style={styles.rangeLbl}>Hasta</Text>
              <Text style={styles.rangeVal}>{formatFechaLarga(hasta)}</Text>
            </View>
          </View>

          <CalendarMonth
            cursor={monthCursor}
            desde={desde}
            hasta={hasta}
            hoy={hoy}
            onPrev={prevMonth}
            onNext={nextMonth}
            onSelect={onSelectDay}
          />

          <View style={styles.helpRow}>
            <Text style={styles.helpText}>
              Toca el primer día y luego el último para definir el rango de vacaciones.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabelText}>Motivo (opcional)</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej: viaje familiar"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.textArea]}
              multiline
              testID="input-motivo"
            />
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>Días hábiles</Text>
              <Text style={styles.summaryVal}>{validacion.diasHabiles}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>Anticipación hábil</Text>
              <Text style={styles.summaryVal}>{validacion.diasAnticipacion}</Text>
            </View>
          </View>

          <View
            style={[
              styles.validationBox,
              {
                backgroundColor: validacion.ok
                  ? COLORS.successLight
                  : COLORS.dangerLight,
              },
            ]}
          >
            {validacion.ok ? (
              <CheckCircle2 size={16} color={COLORS.success} />
            ) : (
              <AlertCircle size={16} color={COLORS.danger} />
            )}
            <Text
              style={[
                styles.validationText,
                {
                  color: validacion.ok ? COLORS.success : COLORS.danger,
                },
              ]}
            >
              {validacion.message}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submit,
              (!validacion.ok || enviando) && { opacity: 0.5 },
            ]}
            onPress={onEnviar}
            disabled={!validacion.ok || enviando}
            activeOpacity={0.85}
            testID="btn-enviar-vacaciones"
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Send size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Enviar solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CalendarMonth({
  cursor,
  desde,
  hasta,
  hoy,
  onPrev,
  onNext,
  onSelect,
}: {
  cursor: Date;
  desde: string;
  hasta: string;
  hoy: Date;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (iso: string) => void;
}): React.ReactElement {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  // Lunes = 0
  const jsDow = firstDay.getDay(); // 0=Dom..6=Sab
  const firstOffset = (jsDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const desdeD = parseFecha(desde);
  const hastaD = parseFecha(hasta);

  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < firstOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    cells.push({ iso: toISODate(date), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.calCard}>
      <View style={styles.calHeader}>
        <TouchableOpacity onPress={onPrev} style={styles.calNavBtn} testID="btn-cal-prev">
          <ChevronLeft size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.calTitle}>
          {MONTH_LABELS[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNext} style={styles.calNavBtn} testID="btn-cal-next">
          <ChevronRight size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEK_LABELS.map((w, i) => (
          <Text key={`${w}-${i}`} style={styles.weekLbl}>{w}</Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={`r-${ri}`} style={styles.calRow}>
          {row.map((cell, ci) => {
            if (!cell) {
              return <View key={`c-${ri}-${ci}`} style={styles.calCellEmpty} />;
            }
            const d = parseFecha(cell.iso);
            const isPast = d ? d < hoy : false;
            const isToday = d ? toISODate(d) === toISODate(hoy) : false;
            const inRange =
              d && desdeD && hastaD && d >= desdeD && d <= hastaD;
            const isStart = cell.iso === desde;
            const isEnd = cell.iso === hasta;
            const isEdge = isStart || isEnd;
            return (
              <TouchableOpacity
                key={`c-${ri}-${ci}`}
                style={[
                  styles.calCell,
                  inRange && !isEdge && styles.calCellRange,
                  isEdge && styles.calCellEdge,
                ]}
                onPress={() => onSelect(cell.iso)}
                disabled={isPast}
                activeOpacity={0.7}
                testID={`cal-day-${cell.iso}`}
              >
                <Text
                  style={[
                    styles.calCellText,
                    isPast && styles.calCellPast,
                    isToday && !isEdge && styles.calCellToday,
                    isEdge && styles.calCellEdgeText,
                  ]}
                >
                  {cell.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rangeBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
  },
  rangeLbl: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  rangeVal: { fontSize: 13, color: COLORS.text, fontWeight: '700', marginTop: 4 },
  rangeArrow: { paddingHorizontal: 2 },
  calCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  calTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLbl: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  calRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
    borderRadius: 10,
  },
  calCellEmpty: { flex: 1, aspectRatio: 1, margin: 1 },
  calCellRange: { backgroundColor: COLORS.primaryLight },
  calCellEdge: { backgroundColor: COLORS.primary },
  calCellText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  calCellPast: { color: COLORS.textMuted, fontWeight: '400' },
  calCellToday: { color: COLORS.primary, fontWeight: '800' },
  calCellEdgeText: { color: '#FFFFFF', fontWeight: '800' },
  helpRow: { paddingHorizontal: 4, paddingTop: 8 },
  helpText: { fontSize: 12, color: COLORS.textSecondary },
  field: { gap: 6, marginTop: 12 },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  summary: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRow: { flex: 1, alignItems: 'center' },
  summaryLbl: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  summaryVal: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  validationText: { flex: 1, fontSize: 13, fontWeight: '600' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
    marginTop: 16,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
