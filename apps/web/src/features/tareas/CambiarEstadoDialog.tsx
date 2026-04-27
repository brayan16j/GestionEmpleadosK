import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cambiarEstadoSchema, type CambiarEstadoInput } from "./schemas";
import type { Tarea } from "./api";
import { useCambiarEstado } from "./queries";
import { useEstados } from "@/features/estados/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiProblem } from "@/lib/problem";

interface CambiarEstadoDialogProps {
  tarea: Tarea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CambiarEstadoDialog({ tarea, open, onOpenChange }: CambiarEstadoDialogProps) {
  const { data: estados } = useEstados();
  const cambiarMutation = useCambiarEstado(tarea.id);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CambiarEstadoInput>({
    resolver: zodResolver(cambiarEstadoSchema),
  });

  // Filter allowed target states from the current estado's cambiosPermitidos CSV
  const allowedNames = tarea.estadoNombre
    ? (estados
        ?.find((e) => e.nombre === tarea.estadoNombre)
        ?.cambiosPermitidos?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [])
    : [];

  const allowedEstados = estados?.filter((e) => allowedNames.includes(e.nombre)) ?? [];

  const onSubmit = async (data: CambiarEstadoInput) => {
    setInlineError(null);
    cambiarMutation.mutate(data, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiProblem) {
          setInlineError(err.detail ?? err.title);
        } else {
          setInlineError("Error inesperado");
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Estado</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-400 mb-2">
          Estado actual: <span className="text-gray-200">{tarea.estadoNombre ?? "—"}</span>
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="idEstado">Nuevo Estado</Label>
            <Select id="idEstado" {...register("idEstado")}>
              <option value="">Seleccionar estado...</option>
              {allowedEstados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </Select>
            {errors.idEstado && (
              <p className="text-red-400 text-sm mt-1">{errors.idEstado.message}</p>
            )}
          </div>
          {inlineError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded p-2">
              {inlineError}
            </p>
          )}
          {allowedEstados.length === 0 && (
            <p className="text-yellow-400 text-sm">
              No hay transiciones de estado permitidas desde el estado actual.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || allowedEstados.length === 0}>
              Cambiar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
