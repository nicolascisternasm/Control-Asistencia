import AsyncStorage from '@react-native-async-storage/async-storage';
import { SolicitudOmitirColacion } from '@/types';
import { supabase, SUPABASE_ENABLED } from '@/services/supabase';

const LOCAL_KEY = 'ca.omitir_colacion.v1';
const PENDING_KEY = 'ca.omitir_colacion.pending.v1';
const TABLE = 'solicitudes_omitir_colacion';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function readLocal(): Promise<SolicitudOmitirColacion[]> {
  return readJson<SolicitudOmitirColacion[]>(LOCAL_KEY, []);
}
async function writeLocal(list: SolicitudOmitirColacion[]): Promise<void> {
  await writeJson(LOCAL_KEY, list);
}
async function readPending(): Promise<SolicitudOmitirColacion[]> {
  return readJson<SolicitudOmitirColacion[]>(PENDING_KEY, []);
}
async function writePending(list: SolicitudOmitirColacion[]): Promise<void> {
  await writeJson(PENDING_KEY, list);
}

function dedupeById(list: SolicitudOmitirColacion[]): SolicitudOmitirColacion[] {
  const map = new Map<string, SolicitudOmitirColacion>();
  for (const item of list) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

async function trySyncPending(): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  const pending = await readPending();
  if (pending.length === 0) return;
  const stillPending: SolicitudOmitirColacion[] = [];
  for (const item of pending) {
    try {
      const { error } = await supabase.from(TABLE).insert(item);
      if (error) {
        console.log('[omitir-colacion] sync pending error', error.message);
        stillPending.push(item);
      } else {
        console.log('[omitir-colacion] synced pending', item.id);
      }
    } catch (e) {
      console.log('[omitir-colacion] sync pending exception', e);
      stillPending.push(item);
    }
  }
  await writePending(stillPending);
}

export const omitirColacionService = {
  async list(trabajadorId?: string): Promise<SolicitudOmitirColacion[]> {
    await trySyncPending();
    let remote: SolicitudOmitirColacion[] | null = null;
    if (SUPABASE_ENABLED && supabase) {
      try {
        const q = supabase
          .from(TABLE)
          .select('*')
          .order('creado_en', { ascending: false });
        const { data, error } = trabajadorId
          ? await q.eq('trabajador_id', trabajadorId)
          : await q;
        if (error) {
          console.log('[omitir-colacion] list error, fallback local', error.message);
        } else if (data) {
          remote = data as SolicitudOmitirColacion[];
        }
      } catch (e) {
        console.log('[omitir-colacion] list exception', e);
      }
    }

    const pending = await readPending();
    const pendingFiltered = trabajadorId
      ? pending.filter((v) => v.trabajador_id === trabajadorId)
      : pending;

    if (remote) {
      const remoteIds = new Set(remote.map((r) => r.id));
      // Limpia de la cola pendiente lo que ya quedó en Supabase
      const allPending = await readPending();
      const cleanedPending = allPending.filter((p) => !remoteIds.has(p.id));
      if (cleanedPending.length !== allPending.length) {
        await writePending(cleanedPending);
      }
      const stillPending = pendingFiltered.filter((p) => !remoteIds.has(p.id));
      // remote primero => gana sobre cualquier copia local stale con mismo id
      const merged = dedupeById([...remote, ...stillPending]);
      await writeLocal(merged);
      return merged.sort((a, b) => b.creado_en.localeCompare(a.creado_en));
    }

    const local = await readLocal();
    const filtered = trabajadorId
      ? local.filter((v) => v.trabajador_id === trabajadorId)
      : local;
    const merged = dedupeById([...filtered, ...pendingFiltered]);
    return merged.sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  },

  async findHoy(
    trabajadorId: string,
    fecha: string,
  ): Promise<SolicitudOmitirColacion | null> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('trabajador_id', trabajadorId)
          .eq('fecha', fecha)
          .order('creado_en', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          const fresh = data[0] as SolicitudOmitirColacion;
          // Sincroniza el cache local con el estado autoritativo del servidor
          const all = await readLocal();
          const idx = all.findIndex((x) => x.id === fresh.id);
          if (idx >= 0) all[idx] = fresh; else all.unshift(fresh);
          await writeLocal(all);
          const pending = await readPending();
          const nextPending = pending.filter((x) => x.id !== fresh.id);
          if (nextPending.length !== pending.length) await writePending(nextPending);
          return fresh;
        }
        if (!error && data && data.length === 0) {
          // El servidor confirmó que no hay solicitud hoy; no devolver copia local stale
          return null;
        }
        if (error) {
          console.log('[omitir-colacion] findHoy error, fallback local', error.message);
        }
      } catch (e) {
        console.log('[omitir-colacion] findHoy exception', e);
      }
    }
    const all = await readLocal();
    return all.find((s) => s.trabajador_id === trabajadorId && s.fecha === fecha) ?? null;
  },

  async add(s: SolicitudOmitirColacion): Promise<SolicitudOmitirColacion> {
    let saved: SolicitudOmitirColacion = s;
    let syncedToRemote = false;
    let remoteError: string | null = null;
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .insert(s)
          .select()
          .single();
        if (error) {
          console.log(
            '[omitir-colacion] add error',
            error.message,
            error.details,
            error.hint,
            error.code,
          );
          remoteError =
            error.message +
            (error.details ? ` (${error.details})` : '') +
            (error.hint ? ` [${error.hint}]` : '');
        } else if (data) {
          saved = data as SolicitudOmitirColacion;
          syncedToRemote = true;
        }
      } catch (e) {
        console.log('[omitir-colacion] add exception', e);
        remoteError = e instanceof Error ? e.message : 'Error desconocido al guardar en Supabase';
      }
    } else {
      remoteError = 'Supabase no configurado';
    }

    if (!syncedToRemote) {
      const pending = await readPending();
      await writePending(dedupeById([saved, ...pending]));
      const all = await readLocal();
      await writeLocal(dedupeById([saved, ...all]));
      console.log('[omitir-colacion] queued pending', saved.id);
      throw new Error(`No se pudo guardar en el servidor: ${remoteError ?? 'desconocido'}`);
    }

    const all = await readLocal();
    await writeLocal(dedupeById([saved, ...all]));
    return saved;
  },

  async update(id: string, patch: Partial<SolicitudOmitirColacion>): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
        if (error) console.log('[omitir-colacion] update error', error.message);
      } catch (e) {
        console.log('[omitir-colacion] update exception', e);
      }
    }
    const all = await readLocal();
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      await writeLocal(all);
    }
    const pending = await readPending();
    const pidx = pending.findIndex((x) => x.id === id);
    if (pidx >= 0) {
      pending[pidx] = { ...pending[pidx], ...patch };
      await writePending(pending);
    }
  },

  async cancel(trabajadorId: string, fecha: string): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq('trabajador_id', trabajadorId)
          .eq('fecha', fecha)
          .eq('estado', 'pendiente');
        if (error) console.log('[omitir-colacion] cancel error', error.message);
      } catch (e) {
        console.log('[omitir-colacion] cancel exception', e);
      }
    }
    const all = await readLocal();
    const next = all.filter(
      (x) => !(x.trabajador_id === trabajadorId && x.fecha === fecha && x.estado === 'pendiente'),
    );
    await writeLocal(next);
    const pending = await readPending();
    const nextPending = pending.filter(
      (x) => !(x.trabajador_id === trabajadorId && x.fecha === fecha && x.estado === 'pendiente'),
    );
    await writePending(nextPending);
  },
};
