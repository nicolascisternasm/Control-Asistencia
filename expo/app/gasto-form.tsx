import React, { useCallback, useMemo, useState } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Save,
  Sparkles,
  Receipt,
  DollarSign,
  Store,
  FileText,
  Tag,
  Calendar,
  Loader2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  COLORS,
  Gasto,
  CategoriaGasto,
  CATEGORIA_GASTO_LABEL,
} from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useGastos } from '@/contexts/GastosContext';
import { gastosService } from '@/services/gastos';

const CATEGORIAS: CategoriaGasto[] = [
  'combustible',
  'alimentacion',
  'alojamiento',
  'materiales',
  'transporte',
  'herramientas',
  'otros',
];

const TIPOS_DOC = ['boleta', 'factura', 'otro'] as const;

type TipoDoc = (typeof TIPOS_DOC)[number];

async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function GastoFormScreen(): React.ReactElement {
  const router = useRouter();
  const { trabajador } = useAuth();
  const { addGasto, isAdding } = useGastos();

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState<boolean>(false);

  const [monto, setMonto] = useState<string>('');
  const [comercio, setComercio] = useState<string>('');
  const [rutComercio, setRutComercio] = useState<string>('');
  const [numeroDoc, setNumeroDoc] = useState<string>('');
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('boleta');
  const [categoria, setCategoria] = useState<CategoriaGasto>('otros');
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [descripcion, setDescripcion] = useState<string>('');

  const tomarFoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa la cámara para tomar la foto');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        mediaTypes: ['images'],
      });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setFotoUri(a.uri);
        const b64 = a.base64 ?? (await uriToBase64(a.uri));
        setFotoBase64(b64);
      }
    } catch (e) {
      console.log('[gasto] camara error', e);
      Alert.alert('Error', 'No se pudo abrir la cámara');
    }
  }, []);

  const elegirFoto = useCallback(async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        base64: true,
        mediaTypes: ['images'],
      });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setFotoUri(a.uri);
        const b64 = a.base64 ?? (await uriToBase64(a.uri));
        setFotoBase64(b64);
      }
    } catch (e) {
      console.log('[gasto] galeria error', e);
      Alert.alert('Error', 'No se pudo abrir la galería');
    }
  }, []);

  const analizarConIA = useCallback(async () => {
    if (!fotoBase64) {
      Alert.alert('Sin imagen', 'Primero toma o elige una foto de la boleta');
      return;
    }
    const TOOLKIT_URL = process.env.EXPO_PUBLIC_TOOLKIT_URL;
    const SECRET = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY;
    if (!TOOLKIT_URL || !SECRET) {
      Alert.alert('Configuración', 'Falta configurar el servicio de IA');
      return;
    }
    setAnalizando(true);
    try {
      const prompt = `Eres un asistente que extrae datos de boletas y facturas chilenas. Analiza la imagen y devuelve SOLO un JSON válido (sin texto adicional, sin markdown, sin \`\`\`) con esta estructura exacta:
{
  "monto": number (monto total en CLP, solo el número entero, sin puntos ni símbolos),
  "comercio": string (nombre del comercio o emisor),
  "rut_comercio": string (RUT del emisor con formato XX.XXX.XXX-X, o vacío si no se ve),
  "numero_documento": string (número del documento, o vacío),
  "tipo_documento": "boleta" | "factura" | "otro",
  "fecha": string (en formato AAAA-MM-DD, o vacío si no se ve),
  "categoria": "combustible" | "alimentacion" | "alojamiento" | "materiales" | "transporte" | "herramientas" | "otros",
  "descripcion": string (resumen corto de lo comprado, máx 80 chars)
}
Si un dato no se ve claro, déjalo vacío ("") o 0. NO inventes datos.`;

      const body = {
        model: 'google/gemini-3.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${fotoBase64}` },
              },
            ],
          },
        ],
      };

      const res = await fetch(`${TOOLKIT_URL}/v2/vercel/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errTxt = await res.text();
        console.log('[gasto] IA error', res.status, errTxt);
        Alert.alert('Error IA', `No se pudo analizar (${res.status})`);
        return;
      }

      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? '';
      console.log('[gasto] IA raw', content);

      let cleaned = content.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }

      let data: {
        monto?: number | string;
        comercio?: string;
        rut_comercio?: string;
        numero_documento?: string;
        tipo_documento?: string;
        fecha?: string;
        categoria?: string;
        descripcion?: string;
      };
      try {
        data = JSON.parse(cleaned);
      } catch (e) {
        console.log('[gasto] IA parse error', e, cleaned);
        Alert.alert('Error', 'La IA no devolvió datos válidos. Intenta nuevamente o ingresa manualmente.');
        return;
      }

      let aplicados = 0;
      if (data.monto !== undefined && data.monto !== null && `${data.monto}`.length > 0) {
        const n = typeof data.monto === 'number'
          ? data.monto
          : parseFloat(String(data.monto).replace(/\./g, '').replace(',', '.'));
        if (!isNaN(n) && n > 0) {
          setMonto(String(Math.round(n)));
          aplicados++;
        }
      }
      if (data.comercio && data.comercio.trim().length > 0) {
        setComercio(data.comercio.trim());
        aplicados++;
      }
      if (data.rut_comercio && data.rut_comercio.trim().length > 0) {
        setRutComercio(data.rut_comercio.trim());
        aplicados++;
      }
      if (data.numero_documento && String(data.numero_documento).trim().length > 0) {
        setNumeroDoc(String(data.numero_documento).trim());
        aplicados++;
      }
      if (data.tipo_documento && (TIPOS_DOC as readonly string[]).includes(data.tipo_documento)) {
        setTipoDoc(data.tipo_documento as TipoDoc);
        aplicados++;
      }
      if (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
        setFecha(data.fecha);
        aplicados++;
      }
      if (data.categoria && (CATEGORIAS as string[]).includes(data.categoria)) {
        setCategoria(data.categoria as CategoriaGasto);
        aplicados++;
      }
      if (data.descripcion && data.descripcion.trim().length > 0) {
        setDescripcion(data.descripcion.trim());
        aplicados++;
      }

      if (aplicados === 0) {
        Alert.alert('Sin datos', 'No se pudieron extraer datos de la imagen. Revisa que la boleta esté clara.');
      } else {
        Alert.alert('Listo', `Se completaron ${aplicados} campo${aplicados === 1 ? '' : 's'} automáticamente. Revisa antes de guardar.`);
      }
    } catch (e) {
      console.log('[gasto] IA fetch error', e);
      Alert.alert('Error', 'No se pudo conectar con el servicio de IA');
    } finally {
      setAnalizando(false);
    }
  }, [fotoBase64]);

  const guardar = useCallback(async () => {
    if (!trabajador) return;
    const montoNum = parseFloat(monto.replace(/\./g, '').replace(',', '.'));
    if (isNaN(montoNum) || montoNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido');
      return;
    }
    if (comercio.trim().length < 2) {
      Alert.alert('Comercio requerido', 'Indica el nombre del comercio');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert('Fecha inválida', 'Formato AAAA-MM-DD');
      return;
    }

    let fotoUrl: string | null = null;
    if (fotoUri) {
      fotoUrl = await gastosService.uploadFoto(fotoUri, trabajador.id);
    }

    const gasto: Gasto = {
      id: `g-${Date.now()}`,
      trabajador_id: trabajador.id,
      trabajador_nombre: `${trabajador.nombres} ${trabajador.apellidos}`,
      fecha_gasto: fecha,
      monto: Math.round(montoNum),
      moneda: 'CLP',
      categoria,
      comercio: comercio.trim(),
      rut_comercio: rutComercio.trim() || null,
      numero_documento: numeroDoc.trim() || null,
      tipo_documento: tipoDoc,
      descripcion: descripcion.trim(),
      foto_url: fotoUrl,
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
      latitud: null,
      longitud: null,
    };

    try {
      await addGasto(gasto);
      router.back();
    } catch (e) {
      console.log('[gasto] save error', e);
      Alert.alert('Error', 'No se pudo guardar el gasto');
    }
  }, [
    trabajador,
    monto,
    comercio,
    fecha,
    fotoUri,
    categoria,
    rutComercio,
    numeroDoc,
    tipoDoc,
    descripcion,
    addGasto,
    router,
  ]);

  const montoFormateado = useMemo(() => {
    const n = parseFloat(monto.replace(/\./g, '').replace(',', '.'));
    if (isNaN(n) || n <= 0) return '';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n);
  }, [monto]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topbar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={10}
            testID="btn-back"
          >
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Nuevo gasto</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.photoCard}>
            {fotoUri ? (
              <View>
                <Image source={{ uri: fotoUri }} style={styles.photo} />
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.photoAction}
                    onPress={tomarFoto}
                    activeOpacity={0.85}
                  >
                    <Camera size={14} color={COLORS.primary} />
                    <Text style={styles.photoActionText}>Reemplazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoAction, styles.photoActionPrimary]}
                    onPress={analizarConIA}
                    activeOpacity={0.85}
                    disabled={analizando}
                    testID="btn-analizar-ia"
                  >
                    {analizando ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Sparkles size={14} color="#FFFFFF" />
                    )}
                    <Text style={[styles.photoActionText, { color: '#FFFFFF' }]}>
                      {analizando ? 'Analizando...' : 'Analizar con IA'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.photoEmpty}>
                <View style={styles.photoIcon}>
                  <Receipt size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.photoTitle}>Adjunta la boleta o factura</Text>
                <Text style={styles.photoSub}>
                  La IA leerá los datos automáticamente
                </Text>
                <View style={styles.photoBtns}>
                  <TouchableOpacity
                    style={[styles.photoBtn, styles.photoBtnPrimary]}
                    onPress={tomarFoto}
                    activeOpacity={0.85}
                    testID="btn-tomar-foto"
                  >
                    <Camera size={16} color="#FFFFFF" />
                    <Text style={styles.photoBtnText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={elegirFoto}
                    activeOpacity={0.85}
                    testID="btn-elegir-foto"
                  >
                    <ImageIcon size={16} color={COLORS.primary} />
                    <Text style={[styles.photoBtnText, { color: COLORS.primary }]}>
                      Galería
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Detalle del gasto</Text>

            <Text style={styles.label}>Monto</Text>
            <View style={styles.input}>
              <DollarSign size={18} color={COLORS.textMuted} />
              <TextInput
                value={monto}
                onChangeText={setMonto}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="number-pad"
                testID="input-monto"
              />
              {montoFormateado ? (
                <Text style={styles.montoLabel}>{montoFormateado}</Text>
              ) : null}
            </View>

            <Text style={styles.label}>Comercio</Text>
            <View style={styles.input}>
              <Store size={18} color={COLORS.textMuted} />
              <TextInput
                value={comercio}
                onChangeText={setComercio}
                placeholder="Nombre del comercio"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-comercio"
              />
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>N° documento</Text>
                <View style={styles.input}>
                  <FileText size={16} color={COLORS.textMuted} />
                  <TextInput
                    value={numeroDoc}
                    onChangeText={setNumeroDoc}
                    placeholder="0000"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    testID="input-numero"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>RUT emisor</Text>
                <View style={styles.input}>
                  <Tag size={16} color={COLORS.textMuted} />
                  <TextInput
                    value={rutComercio}
                    onChangeText={setRutComercio}
                    placeholder="76.xxx.xxx-x"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    testID="input-rut"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Fecha</Text>
            <View style={styles.input}>
              <Calendar size={16} color={COLORS.textMuted} />
              <TextInput
                value={fecha}
                onChangeText={setFecha}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-fecha"
              />
            </View>

            <Text style={styles.label}>Tipo de documento</Text>
            <View style={styles.chips}>
              {TIPOS_DOC.map((t) => {
                const active = tipoDoc === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTipoDoc(t)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.chips}>
              {CATEGORIAS.map((c) => {
                const active = categoria === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategoria(c)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {CATEGORIA_GASTO_LABEL[c]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Descripción</Text>
            <View style={[styles.input, { height: 80, alignItems: 'flex-start', paddingTop: 12 }]}>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Detalle opcional del gasto"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.inputText, { height: 60, textAlignVertical: 'top' }]}
                multiline
                testID="input-descripcion"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, isAdding && styles.ctaDisabled]}
            onPress={guardar}
            disabled={isAdding}
            activeOpacity={0.85}
            testID="btn-save"
          >
            {isAdding ? (
              <Loader2 size={18} color="#FFFFFF" />
            ) : (
              <Save size={18} color="#FFFFFF" />
            )}
            <Text style={styles.ctaText}>
              {isAdding ? 'Guardando...' : 'Registrar gasto'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  topTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 24 },
  photoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  photoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  photoSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  photoBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  photoBtnPrimary: { backgroundColor: COLORS.primary },
  photoBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  photo: { width: '100%', height: 240 },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
  },
  photoAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  photoActionPrimary: { backgroundColor: COLORS.primary },
  photoActionText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 48,
  },
  inputText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  row2: { flexDirection: 'row', gap: 10 },
  montoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  footer: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 14,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
