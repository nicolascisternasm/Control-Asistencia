import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Proyecto MAMKAM. El anon key es público por diseño (RLS protege los datos).
// Se priorizan las variables de entorno si existen, con fallback hardcoded
// para que la app no caiga a modo local si el .env no se inyecta.
const FALLBACK_SUPABASE_URL = 'https://tpowqjovuxnpnfbmnhby.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwb3dxam92dXhucG5mYm1uaGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTc2NDEsImV4cCI6MjA5NDc5MzY0MX0.Cl7P0IeUTLajdvNE0DVwyf1jiZhD-sNtmXDdvd-y250';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL.length > 0
    ? process.env.EXPO_PUBLIC_SUPABASE_URL
    : FALLBACK_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 0
    ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : FALLBACK_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED: boolean =
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

console.log('[supabase] init', {
  enabled: SUPABASE_ENABLED,
  hasUrl: !!SUPABASE_URL,
  urlPrefix: SUPABASE_URL ? SUPABASE_URL.slice(0, 30) : null,
  hasKey: !!SUPABASE_ANON_KEY,
  keyLen: SUPABASE_ANON_KEY?.length ?? 0,
});

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const GASTOS_BUCKET = 'gastos-fotos';
