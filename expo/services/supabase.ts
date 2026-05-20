import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Las credenciales deben venir de variables de entorno en .env.local
// EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

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
