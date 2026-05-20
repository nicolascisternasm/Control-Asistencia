import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Save,
  Trash2,
  Building2,
  Navigation,
  Ruler,
  ShieldCheck,
  Crosshair,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { COLORS, PuntoTrabajo } from '@/types';
import { repo } from '@/services/repository';

export default function PuntoFormScreen(): React.ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);
  const [gettingLoc, setGettingLoc] = useState<boolean>(false);

  const [nombre, setNombre] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [latitud, setLatitud] = useState<string>('');
  const [longitud, setLongitud] = useState<string>('');
  const [radio, setRadio] = useState<string>('150');
  const [activo, setActivo] = useState<boolean>(true);

  type AddrSuggestion = {
    id: string;
    placeId: string;
    label: string;
    sub: string;
  };
  const [suggestions, setSuggestions] = useState<AddrSuggestion[]>([]);
  const [searchingAddr, setSearchingAddr] = useState<boolean>(false);
  const [showSug, setShowSug] = useState<boolean>(false);
  const suppressSearchRef = useRef<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = direccion.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchingAddr(false);
      return;
    }
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.log('[punto-form] missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
      setSuggestions([]);
      setSearchingAddr(false);
      return;
    }
    setSearchingAddr(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const body = {
          input: q,
          languageCode: 'es',
          regionCode: 'CL',
          sessionToken: sessionTokenRef.current,
          locationBias: {
            circle: {
              center: { latitude: -33.45, longitude: -70.66 },
              radius: 50000.0,
            },
          },
        };
        console.log('[punto-form] places autocomplete', q);
        const res = await fetch(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const txt = await res.text();
          console.log('[punto-form] places http', res.status, txt);
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId: string;
              structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
              };
              text?: { text?: string };
            };
          }>;
        };
        const mapped: AddrSuggestion[] = (data.suggestions ?? [])
          .map((s, i) => {
            const p = s.placePrediction;
            if (!p) return null;
            const label =
              p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
            const sub = p.structuredFormat?.secondaryText?.text ?? '';
            return {
              id: `${p.placeId}-${i}`,
              placeId: p.placeId,
              label,
              sub,
            } as AddrSuggestion;
          })
          .filter((x): x is AddrSuggestion => x !== null);
        console.log('[punto-form] places results', mapped.length);
        setSuggestions(mapped);
        setShowSug(true);
      } catch (e) {
        console.log('[punto-form] places error', e);
        setSuggestions([]);
      } finally {
        setSearchingAddr(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [direccion]);

  const pickSuggestion = useCallback(async (s: AddrSuggestion) => {
    suppressSearchRef.current = true;
    const full = s.sub ? `${s.label}, ${s.sub}` : s.label;
    setDireccion(full);
    setSuggestions([]);
    setShowSug(false);
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;
    try {
      setSearchingAddr(true);
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(s.placeId)}?sessionToken=${encodeURIComponent(sessionTokenRef.current)}`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'location,formattedAddress',
          },
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        console.log('[punto-form] place details http', res.status, txt);
        return;
      }
      const data = (await res.json()) as {
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
      };
      if (data.location?.latitude != null && data.location?.longitude != null) {
        setLatitud(data.location.latitude.toFixed(6));
        setLongitud(data.location.longitude.toFixed(6));
      }
      if (data.formattedAddress) {
        suppressSearchRef.current = true;
        setDireccion(data.formattedAddress);
      }
    } catch (e) {
      console.log('[punto-form] place details error', e);
    } finally {
      setSearchingAddr(false);
      sessionTokenRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (isEdit && id) {
        const p = await repo.getPuntoTrabajoById(id as string);
        if (p) {
          setNombre(p.nombre_lugar);
          setDireccion(p.direccion);
          setLatitud(String(p.latitud));
          setLongitud(String(p.longitud));
          setRadio(String(p.radio_permitido_metros));
          setActivo(p.activo);
        }
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const title = useMemo(
    () => (isEdit ? 'Editar punto' : 'Nuevo punto'),
    [isEdit],
  );

  const usarUbicacionActual = useCallback(async () => {
    setGettingLoc(true);
    try {
      if (Platform.OS === 'web') {
        if (!('geolocation' in navigator)) {
          Alert.alert('No disponible', 'Geolocalización no soportada');
          return;
        }
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLatitud(pos.coords.latitude.toFixed(6));
              setLongitud(pos.coords.longitude.toFixed(6));
              resolve();
            },
            () => {
              Alert.alert('Error', 'No se pudo obtener la ubicación');
              resolve();
            },
            { enableHighAccuracy: true },
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Activa los permisos de ubicación');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLatitud(loc.coords.latitude.toFixed(6));
        setLongitud(loc.coords.longitude.toFixed(6));
      }
    } catch (e) {
      console.log('[punto-form] loc error', e);
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLoc(false);
    }
  }, []);

  const guardar = useCallback(async () => {
    if (nombre.trim().length < 2) {
      Alert.alert('Nombre requerido', 'Indica el nombre del lugar');
      return;
    }
    if (direccion.trim().length < 3) {
      Alert.alert('Dirección requerida', 'Ingresa la dirección del punto');
      return;
    }
    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Latitud inválida', 'Debe estar entre -90 y 90');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Longitud inválida', 'Debe estar entre -180 y 180');
      return;
    }
    const radioNum = parseInt(radio, 10);
    if (isNaN(radioNum) || radioNum < 10 || radioNum > 5000) {
      Alert.alert('Radio inválido', 'Debe ser entre 10 y 5000 metros');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await repo.updatePuntoTrabajo(id as string, {
          nombre_lugar: nombre.trim(),
          direccion: direccion.trim(),
          latitud: lat,
          longitud: lng,
          radio_permitido_metros: radioNum,
          activo,
        });
      } else {
        const nuevo: PuntoTrabajo = {
          id: `p-${Date.now()}`,
          nombre_lugar: nombre.trim(),
          direccion: direccion.trim(),
          latitud: lat,
          longitud: lng,
          radio_permitido_metros: radioNum,
          activo,
        };
        await repo.addPuntoTrabajo(nuevo);
      }
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [isEdit, id, nombre, direccion, latitud, longitud, radio, activo, router]);

  const eliminar = useCallback(() => {
    if (!isEdit) return;
    Alert.alert(
      'Eliminar punto',
      `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await repo.deletePuntoTrabajo(id as string);
              router.back();
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'No se pudo eliminar';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  }, [isEdit, id, nombre, router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

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
          <Text style={styles.topTitle}>{title}</Text>
          {isEdit ? (
            <TouchableOpacity
              onPress={eliminar}
              style={styles.delBtn}
              hitSlop={10}
              testID="btn-delete"
            >
              <Trash2 size={20} color={COLORS.danger} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Información</Text>

            <Text style={styles.label}>Nombre del lugar</Text>
            <View style={styles.input}>
              <Building2 size={18} color={COLORS.textMuted} />
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Obra Las Condes"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-nombre"
              />
            </View>

            <Text style={styles.label}>Dirección</Text>
            <View style={styles.input}>
              <MapPin size={18} color={COLORS.textMuted} />
              <TextInput
                value={direccion}
                onChangeText={(t) => {
                  setDireccion(t);
                  setShowSug(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSug(true);
                }}
                placeholder="Dirección de obra o local"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                testID="input-direccion"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {searchingAddr ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : null}
            </View>
            {showSug && suggestions.length > 0 ? (
              <View style={styles.sugList} testID="addr-suggestions">
                {suggestions.map((s, idx) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.sugItem,
                      idx === suggestions.length - 1 && styles.sugItemLast,
                    ]}
                    onPress={() => pickSuggestion(s)}
                    activeOpacity={0.7}
                    testID={`addr-sug-${idx}`}
                  >
                    <MapPin size={16} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sugLabel} numberOfLines={1}>
                        {s.label}
                      </Text>
                      {s.sub ? (
                        <Text style={styles.sugSub} numberOfLines={1}>
                          {s.sub}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
                <Text style={styles.sugFooter}>
                  Sugerencias de Google Places
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Geocerca</Text>
              <TouchableOpacity
                onPress={usarUbicacionActual}
                disabled={gettingLoc}
                style={styles.locBtn}
                activeOpacity={0.85}
                testID="btn-current-loc"
              >
                {gettingLoc ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Crosshair size={14} color={COLORS.primary} />
                )}
                <Text style={styles.locBtnText}>Usar mi ubicación</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Latitud</Text>
                <View style={styles.input}>
                  <Navigation size={16} color={COLORS.textMuted} />
                  <TextInput
                    value={latitud}
                    onChangeText={setLatitud}
                    placeholder="-33.408900"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="numbers-and-punctuation"
                    testID="input-latitud"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Longitud</Text>
                <View style={styles.input}>
                  <Navigation size={16} color={COLORS.textMuted} />
                  <TextInput
                    value={longitud}
                    onChangeText={setLongitud}
                    placeholder="-70.567500"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.inputText}
                    keyboardType="numbers-and-punctuation"
                    testID="input-longitud"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Radio permitido (metros)</Text>
            <View style={styles.input}>
              <Ruler size={18} color={COLORS.textMuted} />
              <TextInput
                value={radio}
                onChangeText={setRadio}
                placeholder="150"
                placeholderTextColor={COLORS.textMuted}
                style={styles.inputText}
                keyboardType="number-pad"
                testID="input-radio"
              />
            </View>
            <Text style={styles.helper}>
              Radio dentro del cual se considera válida la marcación.
              Sugerido entre 50 y 300 metros.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.toggleIcon}>
                  <ShieldCheck size={18} color={activo ? COLORS.success : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Punto activo</Text>
                  <Text style={styles.toggleSub}>
                    {activo ? 'Disponible para asignar a trabajadores' : 'Oculto al asignar'}
                  </Text>
                </View>
              </View>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
                testID="switch-activo"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, saving && styles.ctaDisabled]}
            onPress={guardar}
            disabled={saving}
            activeOpacity={0.85}
            testID="btn-save"
          >
            <Save size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear punto'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
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
  delBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 24 },
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
  },
  locBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  helper: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 17,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sugList: {
    marginTop: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sugItemLast: { borderBottomWidth: 0 },
  sugLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  sugSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sugFooter: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontStyle: 'italic',
  },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
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
