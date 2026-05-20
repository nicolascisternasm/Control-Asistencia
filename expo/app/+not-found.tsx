// 404 NOT FOUND - ControlAsistencia Pro
// Fallback screen for unmatched routes
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../types';
import { Home, AlertCircle } from 'lucide-react-native';

// Error page component
export default function NotFoundScreenComponent() {
  const router = useRouter();
  return (
    <View style={styles.page}>
      <View style={styles.circle}>
        <AlertCircle size={60} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Página no encontrada</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
        <Home size={20} color="#FFF" />
        <Text style={styles.btnText}>Ir al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  circle: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 24 },
  btn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, gap: 8 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
// UNIQUE_ID_1776478927_

// UNIQUE_CHANGE_1776479110_NOT_FOUND
