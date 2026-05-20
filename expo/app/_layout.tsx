import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { MarcacionesProvider } from '@/contexts/MarcacionesContext';
import { GastosProvider } from '@/contexts/GastosContext';
import { VacacionesProvider } from '@/contexts/VacacionesContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { COLORS } from '@/types';

const queryClient = new QueryClient();

function AuthGate(): React.ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const first = segments[0] as string | undefined;
    const inTabs = first === '(tabs)';
    const inAuthedRoute =
      inTabs ||
      first === 'trabajador-form' ||
      first === 'forgot' ||
      first === 'marcacion-detail' ||
      first === 'puntos' ||
      first === 'punto-form' ||
      first === 'gasto-form' ||
      first === 'vacaciones' ||
      first === 'vacacion-form' ||
      first === 'documentos';
    if (isAuthenticated && !inAuthedRoute) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inTabs) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="trabajador-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="marcacion-detail" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="puntos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="punto-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="gasto-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="vacaciones" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="vacacion-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="documentos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayoutNav(): React.ReactElement {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MarcacionesProvider>
            <GastosProvider>
              <VacacionesProvider>
                <ToastProvider>
                  <AuthGate />
                  <StatusBar style="dark" />
                </ToastProvider>
              </VacacionesProvider>
            </GastosProvider>
          </MarcacionesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
