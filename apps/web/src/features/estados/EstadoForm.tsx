import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createEstadoSchema, type CreateEstadoInput, type Estado } from "./schemas";
import { useCreateEstado, useUpdateEstado } from "./queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiProblem } from "@/lib/problem";
import { applyProblemToForm } from "@/lib/applyProblemToForm";

interface EstadoFormProps {
  estado?: Estado;
  onSuccess: () => void;
}

export function EstadoForm({ estado, onSuccess }: EstadoFormProps) {
  const isEdit = estado !== undefined;
  const createMutation = useCreateEstado();
  const updateMutation = useUpdateEstado(estado?.id ?? 0);

  const form = useForm<CreateEstadoInput>({
    resolver: zodResolver(createEstadoSchema),
    defaultValues: estado
      ? {
          nombre: estado.nombre,
          categoria: estado.categoria,
          cambiosPermitidos: estado.cambiosPermitidos ?? null,
        }
      : undefined,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (estado) {
      reset({
        nombre: estado.nombre,
        categoria: estado.categoria,
        cambiosPermitidos: estado.cambiosPermitidos ?? null,
      });
    }
  }, [estado, reset]);

  const onSubmit = async (data: CreateEstadoInput) => {
    const mutation = isEdit ? updateMutation : createMutation;
    mutation.mutate(data as Parameters<typeof mutation.mutate>[0], {
      onSuccess: () => {
        toast.success(isEdit ? "Estado actualizado" : "Estado creado");
        onSuccess();
      },
      onError: (err) => {
        if (err instanceof ApiProblem) {
          const mapped = applyProblemToForm(err, form);
          if (!mapped) {
            toast.error(err.title, { description: err.detail });
          }
        } else {
          toast.error("Error inesperado");
        }
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="estado-nombre">Nombre</Label>
        <Input id="estado-nombre" {...register("nombre")} placeholder="ej. pendiente" />
        {errors.nombre && <p className="text-red-400 text-sm mt-1">{errors.nombre.message}</p>}
      </div>
      <div>
        <Label htmlFor="estado-categoria">Categoría</Label>
        <Input id="estado-categoria" {...register("categoria")} placeholder="ej. activa" />
        {errors.categoria && (
          <p className="text-red-400 text-sm mt-1">{errors.categoria.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="estado-cambios">Cambios Permitidos (CSV)</Label>
        <Input
          id="estado-cambios"
          {...register("cambiosPermitidos")}
          placeholder="ej. en-progreso,finalizada"
        />
        {errors.cambiosPermitidos && (
          <p className="text-red-400 text-sm mt-1">{errors.cambiosPermitidos.message}</p>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isEdit ? "Actualizar" : "Crear"}
        </Button>
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
