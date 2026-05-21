import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Gasto } from '@/types';
import { supabase, SUPABASE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY, GASTOS_BUCKET } from '@/services/supabase';

const LOCAL_KEY = 'ca.gastos.v1';

async function readLocal(): Promise<Gasto[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Gasto[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(list: Gasto[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchToBase64(uri: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const mime = blob.type || 'image/jpeg';
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { base64, mime };
}

export const gastosService = {
  async uploadFoto(localUri: string, trabajadorId: string): Promise<string | null> {
    if (!SUPABASE_ENABLED || !supabase) {
      throw new Error('Supabase no está habilitado');
    }
    const { base64, mime } = await fetchToBase64(localUri);
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const path = `${trabajadorId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = base64ToUint8Array(base64);
    const { error } = await supabase.storage
      .from(GASTOS_BUCKET)
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
      });
    if (error) {
      console.log('[gastos] upload error', error.message);
      throw new Error(`Storage: ${error.message}`);
    }
    const { data: pub } = supabase.storage.from(GASTOS_BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) {
      throw new Error('No se pudo obtener la URL pública de la imagen');
    }
    return pub.publicUrl;
  },

  async list(trabajadorId?: string, empresaId?: string): Promise<Gasto[]> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        let q = supabase
          .from('gastos')
          .select('*')
          .order('creado_en', { ascending: false });
        if (trabajadorId) q = q.eq('trabajador_id', trabajadorId);
        if (empresaId) q = q.eq('empresa_id', empresaId);
        const { data, error } = await q;
        if (error) {
          console.log('[gastos] list error, fallback local', error.message);
        } else if (data) {
          return data as Gasto[];
        }
      } catch (e) {
        console.log('[gastos] list exception', e);
      }
    }
    const all = await readLocal();
    return all.filter((g) => {
      if (trabajadorId && g.trabajador_id !== trabajadorId) return false;
      if (empresaId && (g.empresa_id ?? '') !== empresaId) return false;
      return true;
    });
  },

  async add(g: Gasto): Promise<Gasto> {
    if (SUPABASE_ENABLED && supabase) {
      const { data, error } = await supabase
        .from('gastos')
        .insert(g)
        .select()
        .single();
      if (error) {
        console.log('[gastos] add error (NO fallback)', error.message);
        throw new Error(`Supabase: ${error.message}`);
      }
      const saved = (data ?? g) as Gasto;
      const all = await readLocal();
      all.unshift(saved);
      await writeLocal(all);
      return saved;
    }
    const all = await readLocal();
    all.unshift(g);
    await writeLocal(all);
    return g;
  },

  async updateEstado(id: string, estado: Gasto['estado']): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      const { error } = await supabase
        .from('gastos')
        .update({ estado })
        .eq('id', id);
      if (error) {
        console.log('[gastos] update estado error', error.message);
        throw new Error(`Supabase: ${error.message}`);
      }
    }
    const all = await readLocal();
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], estado };
      await writeLocal(all);
    }
  },

  async remove(id: string): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase.from('gastos').delete().eq('id', id);
        if (error) console.log('[gastos] delete error', error.message);
      } catch (e) {
        console.log('[gastos] delete exception', e);
      }
    }
    const all = await readLocal();
    await writeLocal(all.filter((x) => x.id !== id));
  },

  async diagnose(): Promise<{
    enabled: boolean;
    url: string | null;
    keyLen: number;
    canSelect: boolean;
    canInsert: boolean;
    canBucket: boolean;
    error: string | null;
  }> {
    const result = {
      enabled: SUPABASE_ENABLED,
      url: SUPABASE_URL || null,
      keyLen: SUPABASE_ANON_KEY?.length ?? 0,
      canSelect: false,
      canInsert: false,
      canBucket: false,
      error: null as string | null,
    };
    if (!SUPABASE_ENABLED || !supabase) {
      result.error = 'Supabase no está habilitado (faltan variables)';
      return result;
    }
    try {
      const { error: selErr } = await supabase
        .from('gastos')
        .select('id', { head: true, count: 'exact' });
      if (selErr) {
        result.error = `SELECT: ${selErr.message}`;
      } else {
        result.canSelect = true;
      }
    } catch (e) {
      result.error = `SELECT exception: ${String(e)}`;
    }
    try {
      const testGasto = {
        id: Crypto.randomUUID(),
        trabajador_id: 'diag-trab',
        trabajador_nombre: 'Diagnóstico',
        fecha_gasto: new Date().toISOString().slice(0, 10),
        monto: 1,
        moneda: 'CLP',
        categoria: 'otros' as const,
        comercio: '__diagnostico__',
        rut_comercio: null,
        numero_documento: null,
        tipo_documento: 'otro' as const,
        descripcion: 'Test de conexión',
        foto_url: null,
        estado: 'pendiente' as const,
        creado_en: new Date().toISOString(),
        latitud: null,
        longitud: null,
      };
      const { error: insErr } = await supabase.from('gastos').insert(testGasto);
      if (insErr) {
        result.error = (result.error ? result.error + ' | ' : '') + `INSERT: ${insErr.message}`;
      } else {
        result.canInsert = true;
        await supabase.from('gastos').delete().eq('id', testGasto.id);
      }
    } catch (e) {
      result.error = (result.error ? result.error + ' | ' : '') + `INSERT exception: ${String(e)}`;
    }
    try {
      const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
      if (bErr) {
        result.error = (result.error ? result.error + ' | ' : '') + `BUCKETS: ${bErr.message}`;
      } else {
        result.canBucket = !!buckets?.some((b) => b.name === GASTOS_BUCKET);
        if (!result.canBucket) {
          result.error = (result.error ? result.error + ' | ' : '') + `Bucket '${GASTOS_BUCKET}' no existe`;
        }
      }
    } catch (e) {
      result.error = (result.error ? result.error + ' | ' : '') + `BUCKETS exception: ${String(e)}`;
    }
    return result;
  },

  platform: Platform.OS,
};
