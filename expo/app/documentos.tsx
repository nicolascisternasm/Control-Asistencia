import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  FileSignature,
  Wallet,
  Building2,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  ShieldAlert,
  BookOpen,
  HardHat,
  Scale,
  Calendar,
} from 'lucide-react-native';
import { COLORS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

type Estado = 'vigente' | 'firmado' | 'pagado' | 'pendiente' | 'disponible';

interface DocItem {
  id: string;
  nombre: string;
  fecha: string;
  estado: Estado;
  descripcion?: string;
  url: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  monto?: number;
  fechaPagoEstimada?: string;
}

const MOCK_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

function estadoStyle(e: Estado): { bg: string; fg: string; label: string } {
  switch (e) {
    case 'vigente':
      return { bg: COLORS.successLight, fg: COLORS.success, label: 'Vigente' };
    case 'firmado':
      return { bg: COLORS.primaryLight, fg: COLORS.primary, label: 'Firmado' };
    case 'pagado':
      return { bg: COLORS.successLight, fg: COLORS.success, label: 'Pagado' };
    case 'pendiente':
      return { bg: COLORS.warningLight, fg: COLORS.warning, label: 'Pendiente' };
    case 'disponible':
    default:
      return { bg: COLORS.primaryLight, fg: COLORS.primary, label: 'Disponible' };
  }
}

type Tab = 'contrato' | 'anexos' | 'liquidaciones' | 'empresa';

export default function DocumentosScreen(): React.ReactElement {
  const router = useRouter();
  const { trabajador } = useAuth();
  const [tab, setTab] = useState<Tab>('contrato');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 700));
    setRefreshing(false);
  };

  const contrato: DocItem = useMemo(
    () => ({
      id: 'c-001',
      nombre: 'Contrato de Trabajo Indefinido',
      fecha: '2024-03-15',
      estado: 'vigente',
      descripcion: `${trabajador?.empresa ?? 'Empresa'} · ${trabajador?.cargo ?? 'Cargo'}`,
      url: MOCK_PDF,
      Icon: FileSignature,
    }),
    [trabajador],
  );

  const anexos: DocItem[] = useMemo(
    () => [
      {
        id: 'a-001',
        nombre: 'Anexo Nº1 - Cambio de cargo',
        fecha: '2024-08-01',
        estado: 'firmado',
        descripcion: 'Actualización de funciones y responsabilidades',
        url: MOCK_PDF,
        Icon: FileText,
      },
      {
        id: 'a-002',
        nombre: 'Anexo Nº2 - Aumento de sueldo',
        fecha: '2025-01-10',
        estado: 'firmado',
        descripcion: 'Reajuste salarial anual',
        url: MOCK_PDF,
        Icon: FileText,
      },
      {
        id: 'a-003',
        nombre: 'Anexo Nº3 - Bono producción',
        fecha: '2025-09-22',
        estado: 'firmado',
        descripcion: 'Incorporación de bono variable trimestral',
        url: MOCK_PDF,
        Icon: FileText,
      },
    ],
    [],
  );

  const liquidacionesPagadas: DocItem[] = useMemo(
    () => [
      { id: 'lp-005', nombre: 'Liquidación Abril 2026', fecha: '2026-05-05', estado: 'pagado', monto: 920500, url: MOCK_PDF, Icon: Wallet },
      { id: 'lp-004', nombre: 'Liquidación Marzo 2026', fecha: '2026-04-05', estado: 'pagado', monto: 915000, url: MOCK_PDF, Icon: Wallet },
      { id: 'lp-003', nombre: 'Liquidación Febrero 2026', fecha: '2026-03-05', estado: 'pagado', monto: 910000, url: MOCK_PDF, Icon: Wallet },
      { id: 'lp-002', nombre: 'Liquidación Enero 2026', fecha: '2026-02-05', estado: 'pagado', monto: 905000, url: MOCK_PDF, Icon: Wallet },
      { id: 'lp-001', nombre: 'Liquidación Diciembre 2025', fecha: '2026-01-05', estado: 'pagado', monto: 1120000, url: MOCK_PDF, Icon: Wallet },
    ],
    [],
  );

  const liquidacionesPendientes: DocItem[] = useMemo(
    () => [
      { id: 'lpe-001', nombre: 'Liquidación Mayo 2026', fecha: '2026-05-31', estado: 'pendiente', monto: 920500, fechaPagoEstimada: '2026-06-05', url: MOCK_PDF, Icon: Wallet },
    ],
    [],
  );

  const empresa: DocItem[] = useMemo(
    () => [
      { id: 'e-001', nombre: 'Reglamento Interno de Orden, Higiene y Seguridad', fecha: '2025-01-01', estado: 'vigente', descripcion: 'Normativa interna de la empresa', url: MOCK_PDF, Icon: BookOpen },
      { id: 'e-002', nombre: 'Protocolo de Prevención de Riesgos', fecha: '2025-03-12', estado: 'vigente', descripcion: 'Procedimientos de seguridad laboral', url: MOCK_PDF, Icon: HardHat },
      { id: 'e-003', nombre: 'Política de Acoso Laboral y Sexual', fecha: '2024-11-20', estado: 'vigente', descripcion: 'Ley Karin · canal de denuncia', url: MOCK_PDF, Icon: ShieldAlert },
      { id: 'e-004', nombre: 'Código de Ética', fecha: '2024-06-01', estado: 'vigente', descripcion: 'Principios y valores corporativos', url: MOCK_PDF, Icon: Scale },
    ],
    [],
  );

  const handleAccion = async (tipo: 'ver' | 'descargar', doc: DocItem) => {
    try {
      const can = await Linking.canOpenURL(doc.url);
      if (!can) throw new Error('no-open');
      await Linking.openURL(doc.url);
    } catch (e) {
      console.log('[documentos] no se pudo abrir', e);
      Alert.alert(
        tipo === 'ver' ? 'Visualizar' : 'Descargar',
        `Mock: ${doc.nombre}\n\nEn producción aquí se ${tipo === 'ver' ? 'abriría el visor PDF' : 'descargaría el archivo'} desde el servidor.`,
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="btn-back-docs">
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Documentos Asociados</Text>
          <Text style={styles.subtitle}>Tus documentos laborales</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        <TabBtn label="Contrato" active={tab === 'contrato'} Icon={FileSignature} onPress={() => setTab('contrato')} />
        <TabBtn label="Anexos" active={tab === 'anexos'} Icon={FileText} onPress={() => setTab('anexos')} count={anexos.length} />
        <TabBtn label="Liquidaciones" active={tab === 'liquidaciones'} Icon={Wallet} onPress={() => setTab('liquidaciones')} count={liquidacionesPendientes.length} highlight />
        <TabBtn label="Empresa" active={tab === 'empresa'} Icon={Building2} onPress={() => setTab('empresa')} count={empresa.length} />
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.loader}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton}>
                <View style={styles.skelIcon} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skelLine, { width: '70%' }]} />
                  <View style={[styles.skelLine, { width: '40%' }]} />
                </View>
              </View>
            ))}
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <>
            {tab === 'contrato' && (
              <>
                <Section title="Contrato vigente" subtitle="Documento principal de tu relación laboral" />
                <DocCard doc={contrato} onVer={() => handleAccion('ver', contrato)} onDescargar={() => handleAccion('descargar', contrato)} highlight />
              </>
            )}

            {tab === 'anexos' && (
              <>
                <Section title="Anexos de contrato" subtitle={`${anexos.length} anexos asociados`} />
                {anexos.map((a) => (
                  <DocCard key={a.id} doc={a} onVer={() => handleAccion('ver', a)} onDescargar={() => handleAccion('descargar', a)} />
                ))}
              </>
            )}

            {tab === 'liquidaciones' && (
              <>
                {liquidacionesPendientes.length > 0 && (
                  <>
                    <Section
                      title="Pendientes"
                      subtitle="Liquidaciones por pagar"
                      badge={{ label: `${liquidacionesPendientes.length}`, bg: COLORS.warningLight, fg: COLORS.warning }}
                    />
                    {liquidacionesPendientes.map((l) => (
                      <LiquidacionCard
                        key={l.id}
                        doc={l}
                        pendiente
                        onVer={() => handleAccion('ver', l)}
                        onDescargar={() => handleAccion('descargar', l)}
                      />
                    ))}
                  </>
                )}

                <Section
                  title="Pagadas"
                  subtitle="Historial de remuneraciones"
                  badge={{ label: `${liquidacionesPagadas.length}`, bg: COLORS.successLight, fg: COLORS.success }}
                />
                {liquidacionesPagadas.map((l) => (
                  <LiquidacionCard
                    key={l.id}
                    doc={l}
                    onVer={() => handleAccion('ver', l)}
                    onDescargar={() => handleAccion('descargar', l)}
                  />
                ))}
              </>
            )}

            {tab === 'empresa' && (
              <>
                <Section title="Documentos de empresa" subtitle="Reglamentos, protocolos y políticas" />
                {empresa.map((e) => (
                  <DocCard key={e.id} doc={e} onVer={() => handleAccion('ver', e)} onDescargar={() => handleAccion('descargar', e)} />
                ))}
              </>
            )}

            <Text style={styles.footnote}>
              Los documentos son de solo lectura. Si necesitas modificar algo contacta a Recursos Humanos.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({
  label,
  active,
  Icon,
  onPress,
  count,
  highlight,
}: {
  label: string;
  active: boolean;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  count?: number;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.tab, active && styles.tabActive]}
      testID={`tab-${label}`}
    >
      <Icon size={15} color={active ? '#FFFFFF' : COLORS.textSecondary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {typeof count === 'number' && count > 0 && (
        <View
          style={[
            styles.tabBadge,
            {
              backgroundColor: active
                ? 'rgba(255,255,255,0.25)'
                : highlight
                ? COLORS.warningLight
                : COLORS.surfaceAlt,
            },
          ]}
        >
          <Text
            style={[
              styles.tabBadgeText,
              {
                color: active
                  ? '#FFFFFF'
                  : highlight
                  ? COLORS.warning
                  : COLORS.textSecondary,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function Section({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: { label: string; bg: string; fg: string };
}): React.ReactElement {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
      {!!badge && (
        <View style={[styles.sectionBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.sectionBadgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      )}
    </View>
  );
}

function DocCard({
  doc,
  onVer,
  onDescargar,
  highlight,
}: {
  doc: DocItem;
  onVer: () => void;
  onDescargar: () => void;
  highlight?: boolean;
}): React.ReactElement {
  const est = estadoStyle(doc.estado);
  const Icon = doc.Icon;
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={styles.cardTop}>
        <View style={[styles.docIcon, highlight && { backgroundColor: COLORS.primary }]}>
          <Icon size={20} color={highlight ? '#FFFFFF' : COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={2}>{doc.nombre}</Text>
          {!!doc.descripcion && (
            <Text style={styles.docDesc} numberOfLines={2}>{doc.descripcion}</Text>
          )}
          <View style={styles.metaRow}>
            <Calendar size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDate(doc.fecha)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>PDF</Text>
          </View>
        </View>
        <View style={[styles.estado, { backgroundColor: est.bg }]}>
          <Text style={[styles.estadoText, { color: est.fg }]}>{est.label}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={onVer}
          activeOpacity={0.85}
          testID={`btn-ver-${doc.id}`}
        >
          <Eye size={15} color={COLORS.primary} />
          <Text style={[styles.btnText, { color: COLORS.primary }]}>Visualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={onDescargar}
          activeOpacity={0.85}
          testID={`btn-descargar-${doc.id}`}
        >
          <Download size={15} color="#FFFFFF" />
          <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Descargar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LiquidacionCard({
  doc,
  onVer,
  onDescargar,
  pendiente,
}: {
  doc: DocItem;
  onVer: () => void;
  onDescargar: () => void;
  pendiente?: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.liqCard, pendiente && styles.liqPending]}>
      <View style={styles.liqLeft}>
        <View style={[styles.liqIcon, { backgroundColor: pendiente ? COLORS.warningLight : COLORS.successLight }]}>
          {pendiente ? (
            <Clock size={20} color={COLORS.warning} />
          ) : (
            <CheckCircle2 size={20} color={COLORS.success} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.liqName}>{doc.nombre}</Text>
          <Text style={styles.liqSub}>
            {pendiente
              ? `Pago estimado: ${formatDate(doc.fechaPagoEstimada ?? doc.fecha)}`
              : `Pagado el ${formatDate(doc.fecha)}`}
          </Text>
        </View>
      </View>

      <View style={styles.liqRight}>
        {typeof doc.monto === 'number' && (
          <Text style={[styles.liqMonto, { color: pendiente ? COLORS.warning : COLORS.success }]}>
            {formatCLP(doc.monto)}
          </Text>
        )}
        <View style={styles.liqActions}>
          <TouchableOpacity onPress={onVer} style={styles.liqIconBtn} activeOpacity={0.8} testID={`btn-ver-${doc.id}`}>
            <Eye size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDescargar} style={[styles.liqIconBtn, { backgroundColor: COLORS.primary }]} activeOpacity={0.8} testID={`btn-descargar-${doc.id}`}>
            <Download size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatCLP(n: number): string {
  try {
    return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  } catch {
    return `$${n}`;
  }
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  tabs: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' as const },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: { fontSize: 11, fontWeight: '800' as const },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' as const },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(15,23,42,0.04)' as unknown as string }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 2,
          elevation: 1,
        }),
  },
  cardHighlight: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docName: { fontSize: 15, fontWeight: '800' as const, color: COLORS.text },
  docDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  metaText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' as const },
  metaDot: { fontSize: 11, color: COLORS.textMuted },
  estado: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  estadoText: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.3 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnGhost: { backgroundColor: COLORS.primaryLight },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnText: { fontSize: 13, fontWeight: '700' as const },

  liqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liqPending: {
    borderWidth: 1,
    borderColor: COLORS.warningLight,
    backgroundColor: '#FFFBEB',
  },
  liqLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  liqIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liqName: { fontSize: 14, fontWeight: '700' as const, color: COLORS.text },
  liqSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  liqRight: { alignItems: 'flex-end', gap: 8 },
  liqMonto: { fontSize: 14, fontWeight: '800' as const },
  liqActions: { flexDirection: 'row', gap: 6 },
  liqIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loader: { gap: 10, paddingTop: 4 },
  skeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skelIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.surfaceAlt },
  skelLine: { height: 10, borderRadius: 6, backgroundColor: COLORS.surfaceAlt },

  footnote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});
