import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listEstados, getEstado, createEstado, updateEstado, deleteEstado } from "./api";
import type { CreateEstadoInput, UpdateEstadoInput } from "./schemas";

export const estadosKeys = {
  all: ["estados"] as const,
  detail: (id: number) => ["estados", id] as const,
};

export function useEstados() {
  return useQuery({
    queryKey: estadosKeys.all,
    queryFn: listEstados,
  });
}

export function useEstado(id: number) {
  return useQuery({
    queryKey: estadosKeys.detail(id),
    queryFn: () => getEstado(id),
  });
}

export function useCreateEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEstadoInput) => createEstado(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estadosKeys.all });
    },
  });
}

export function useUpdateEstado(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEstadoInput) => updateEstado(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estadosKeys.all });
      void qc.invalidateQueries({ queryKey: estadosKeys.detail(id) });
    },
  });
}

export function useDeleteEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEstado(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estadosKeys.all });
    },
  });
}
