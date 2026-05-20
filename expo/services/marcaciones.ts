import AsyncStorage from '@react-native-async-storage/async-storage';
import { Marcacion } from '@/types';
import { supabase, SUPABASE_ENABLED } from '@/services/supabase';

const LOCAL_KEY = 'ca.marcaciones.v1';

async function readLocal(): Promise<Marcacion[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Marcacion[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(list: Marcacion[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

export const marcacionesService = {
  async list(trabajadorId?: string): Promise<Marcacion[]> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const q = supabase
          .from('marcaciones')
          .select('*')
          .order('fecha_hora_servidor', { ascending: false });
        const { data, error } = trabajadorId
          ? await q.eq('trabajador_id', trabajadorId)
          : await q;
        if (error) {
          console.log('[marcaciones] list error, fallback local', error.message);
        } else if (data) {
          return data as Marcacion[];
        }
      } catch (e) {
        console.log('[marcaciones] list exception', e);
      }
    }
    const all = await readLocal();
    return trabajadorId ? all.filter((m) => m.trabajador_id === trabajadorId) : all;
  },

  async add(m: Marcacion): Promise<Marcacion> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase
          .from('marcaciones')
          .insert(m)
          .select()
          .single();
        if (error) {
          console.log('[marcaciones] add error, fallback local', error.message);
        } else if (data) {
          const all = await readLocal();
          all.unshift(data as Marcacion);
          await writeLocal(all);
          return data as Marcacion;
        }
      } catch (e) {
        console.log('[marcaciones] add exception', e);
      }
    }
    const all = await readLocal();
    all.unshift(m);
    await writeLocal(all);
    return m;
  },
};
