import AsyncStorage from '@react-native-async-storage/async-storage';
import { SolicitudVacaciones } from '@/types';
import { supabase, SUPABASE_ENABLED } from '@/services/supabase';

const LOCAL_KEY = 'ca.vacaciones.v1';
const PENDING_KEY = 'ca.vacaciones.pending.v1';
const TABLE = 'solicitudes_vacaciones';

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

async function readLocal(): Promise<SolicitudVacaciones[]> {
  return readJson<SolicitudVacaciones[]>(LOCAL_KEY, []);
}
async function writeLocal(list: SolicitudVacaciones[]): Promise<void> {
  await writeJson(LOCAL_KEY, list);
}
async function readPending(): Promise<SolicitudVacaciones[]> {
  return readJson<SolicitudVacaciones[]>(PENDING_KEY, []);
}
async function writePending(list: SolicitudVacaciones[]): Promise<void> {
  await writeJson(PENDING_KEY, list);
}

function dedupeById(list: SolicitudVacaciones[]): SolicitudVacaciones[] {
  const map = new Map<string, SolicitudVacaciones>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

async function trySyncPending(): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  const pending = await readPending();
  if (pending.length === 0) return;
  const stillPending: SolicitudVacaciones[] = [];
  for (const item of pending) {
    try {
      const { error } = await supabase.from(TABLE).insert(item);
      if (error) {
        console.log('[vacaciones] sync pending error', error.message);
        stillPending.push(item);
      } else {
        console.log('[vacaciones] synced pending', item.id);
      }
    } catch (e) {
      console.log('[vacaciones] sync pending exception', e);
      stillPending.push(item);
    }
  }
  await writePending(stillPending);
}

export const vacacionesService = {
  async list(trabajadorId?: string): Promise<SolicitudVacaciones[]> {
    await trySyncPending();
    let remote: SolicitudVacaciones[] | null = null;
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
          console.log('[vacaciones] list error, fallback local', error.message);
        } else if (data) {
          remote = data as SolicitudVacaciones[];
        }
      } catch (e) {
        console.log('[vacaciones] list exception', e);
      }
    }

    const pending = await readPending();
    const pendingFiltered = trabajadorId
      ? pending.filter((v) => v.trabajador_id === trabajadorId)
      : pending;

    if (remote) {
      const merged = dedupeById([...remote, ...pendingFiltered]);
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

  async add(s: SolicitudVacaciones): Promise<SolicitudVacaciones> {
    let saved: SolicitudVacaciones = s;
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
          console.log('[vacaciones] add error', error.message, error.details, error.hint, error.code);
          remoteError = error.message + (error.details ? ` (${error.details})` : '') + (error.hint ? ` [${error.hint}]` : '');
        } else if (data) {
          saved = data as SolicitudVacaciones;
          syncedToRemote = true;
        }
      } catch (e) {
        console.log('[vacaciones] add exception', e);
        remoteError = e instanceof Error ? e.message : 'Error desconocido al guardar en Supabase';
      }
    } else {
      remoteError = 'Supabase no configurado';
    }

    if (!syncedToRemote) {
      // Guardamos en cola local para reintentar luego, pero propagamos el error
      // para que el trabajador sepa que la solicitud NO llegó al servidor.
      const pending = await readPending();
      const nextPending = dedupeById([saved, ...pending]);
      await writePending(nextPending);
      const all = await readLocal();
      await writeLocal(dedupeById([saved, ...all]));
      console.log('[vacaciones] queued pending', saved.id);
      throw new Error(`No se pudo guardar en el servidor: ${remoteError ?? 'desconocido'}`);
    }

    const all = await readLocal();
    const next = dedupeById([saved, ...all]);
    await writeLocal(next);
    return saved;
  },

  async update(id: string, patch: Partial<SolicitudVacaciones>): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
        if (error) console.log('[vacaciones] update error', error.message);
      } catch (e) {
        console.log('[vacaciones] update exception', e);
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

  async cancel(id: string, trabajadorId: string): Promise<void> {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq('id', id)
          .eq('trabajador_id', trabajadorId)
          .eq('estado', 'pendiente');
        if (error) console.log('[vacaciones] cancel error', error.message);
      } catch (e) {
        console.log('[vacaciones] cancel exception', e);
      }
    }
    const all = await readLocal();
    const next = all.filter(
      (x) => !(x.id === id && x.trabajador_id === trabajadorId && x.estado === 'pendiente'),
    );
    await writeLocal(next);
    const pending = await readPending();
    const nextPending = pending.filter(
      (x) => !(x.id === id && x.trabajador_id === trabajadorId && x.estado === 'pendiente'),
    );
    await writePending(nextPending);
  },
};
