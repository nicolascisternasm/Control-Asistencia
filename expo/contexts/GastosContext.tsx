import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Gasto } from '@/types';
import { gastosService } from '@/services/gastos';
import { useAuth } from '@/contexts/AuthContext';

export const [GastosProvider, useGastos] = createContextHook(() => {
  const { trabajador, isAdmin } = useAuth();
  const qc = useQueryClient();
  const trabajadorId = trabajador?.id;
  const scopeId = isAdmin ? undefined : trabajadorId;

  const gastosQuery = useQuery({
    queryKey: ['gastos', scopeId ?? 'all'],
    queryFn: async () => gastosService.list(scopeId),
    enabled: !!trabajador,
  });

  const addMutation = useMutation({
    mutationFn: async (g: Gasto) => gastosService.add(g),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
    },
  });

  const updateEstadoMutation = useMutation({
    mutationFn: async (p: { id: string; estado: Gasto['estado'] }) =>
      gastosService.updateEstado(p.id, p.estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => gastosService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
    },
  });

  const gastos = useMemo<Gasto[]>(
    () => gastosQuery.data ?? [],
    [gastosQuery.data],
  );

  const refetch = useCallback(async () => {
    await gastosQuery.refetch();
  }, [gastosQuery]);

  const totalMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return gastos
      .filter((g) => g.fecha_gasto.startsWith(ym))
      .reduce((acc, g) => acc + (g.monto || 0), 0);
  }, [gastos]);

  return {
    gastos,
    isLoading: gastosQuery.isLoading,
    isFetching: gastosQuery.isFetching,
    totalMes,
    refetch,
    addGasto: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateEstado: updateEstadoMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  };
});
