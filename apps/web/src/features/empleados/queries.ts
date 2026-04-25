import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listEmpleados,
  getEmpleado,
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  listTareasForEmpleado,
} from "./api";
import type { CreateEmpleadoInput, UpdateEmpleadoInput } from "./schemas";

export const empleadosKeys = {
  all: ["empleados"] as const,
  detail: (id: number) => ["empleados", id] as const,
  tareas: (id: number) => ["empleados", id, "tareas"] as const,
};

export function useEmpleados() {
  return useQuery({
    queryKey: empleadosKeys.all,
    queryFn: listEmpleados,
  });
}

export function useEmpleado(id: number) {
  return useQuery({
    queryKey: empleadosKeys.detail(id),
    queryFn: () => getEmpleado(id),
  });
}

export function useEmpleadoTareas(id: number) {
  return useQuery({
    queryKey: empleadosKeys.tareas(id),
    queryFn: () => listTareasForEmpleado(id),
  });
}

export function useCreateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEmpleadoInput) => createEmpleado(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: empleadosKeys.all });
    },
  });
}

export function useUpdateEmpleado(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEmpleadoInput) => updateEmpleado(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: empleadosKeys.all });
      void qc.invalidateQueries({ queryKey: empleadosKeys.detail(id) });
    },
  });
}

export function useDeleteEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEmpleado(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: empleadosKeys.all });
    },
  });
}
