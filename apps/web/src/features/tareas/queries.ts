import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTareas,
  listTareasByCategoria,
  getTarea,
  createTarea,
  updateTarea,
  cambiarEstado,
  deleteTarea,
} from "./api";
import type { CreateTareaInput, UpdateTareaInput, CambiarEstadoInput } from "./schemas";

export const tareasKeys = {
  all: ["tareas"] as const,
  filtered: (categoria: string) => ["tareas", { categoria }] as const,
  detail: (id: number) => ["tareas", id] as const,
};

export function useTareas(categoria?: string) {
  return useQuery({
    queryKey: categoria ? tareasKeys.filtered(categoria) : tareasKeys.all,
    queryFn: () => (categoria ? listTareasByCategoria(categoria) : listTareas()),
  });
}

export function useTarea(id: number) {
  return useQuery({
    queryKey: tareasKeys.detail(id),
    queryFn: () => getTarea(id),
  });
}

export function useCreateTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTareaInput) => createTarea(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tareasKeys.all });
    },
  });
}

export function useUpdateTarea(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTareaInput) => updateTarea(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tareasKeys.all });
      void qc.invalidateQueries({ queryKey: tareasKeys.detail(id) });
    },
  });
}

export function useCambiarEstado(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CambiarEstadoInput) => cambiarEstado(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tareasKeys.all });
      void qc.invalidateQueries({ queryKey: tareasKeys.detail(id) });
    },
  });
}

export function useDeleteTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTarea(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tareasKeys.all });
    },
  });
}
