import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createTareaSchema, type CreateTareaInput } from "./schemas";
import { useCreateTarea, useUpdateTarea, useTarea } from "./queries";
import { useEmpleados } from "@/features/empleados/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiProblem } from "@/lib/problem";
import { applyProblemToForm } from "@/lib/applyProblemToForm";

interface TareaFormProps {
  editMode?: boolean;
}

export function TareaForm({ editMode = false }: TareaFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : undefined;

  const { data: tarea } = useTarea(numericId ?? 0);
  const { data: empleados } = useEmpleados();
  const createMutation = useCreateTarea();
  const updateMutation = useUpdateTarea(numericId ?? 0);

  const form = useForm<CreateTareaInput>({
    resolver: zodResolver(createTareaSchema),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (editMode && tarea) {
      reset({
        nombre: tarea.nombre,
        fechaCreacion: tarea.fechaCreacion,
        fechaInicioTarea: tarea.fechaInicioTarea,
        fechaFinalizacion: tarea.fechaFinalizacion,
        idEmpleado: tarea.idEmpleado,
      });
    }
  }, [editMode, tarea, reset]);

  const onSubmit = async (data: CreateTareaInput) => {
    // Omit estadoNombre when empty so API applies the pendiente default
    const payload: CreateTareaInput = {
      ...data,
      estadoNombre: data.estadoNombre || undefined,
    };
    const mutation = editMode && numericId ? updateMutation : createMutation;
    mutation.mutate(payload as Parameters<typeof mutation.mutate>[0], {
      onSuccess: () => {
        toast.success(editMode ? "Tarea actualizada" : "Tarea creada");
        void navigate("/tareas");
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
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">{editMode ? "Editar Tarea" : "Nueva Tarea"}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="tarea-nombre">Nombre</Label>
          <Input id="tarea-nombre" {...register("nombre")} placeholder="Nombre de la tarea" />
          {errors.nombre && <p className="text-red-400 text-sm mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <Label htmlFor="tarea-empleado">Empleado</Label>
          <Select id="tarea-empleado" {...register("idEmpleado")}>
            <option value="">Seleccionar empleado...</option>
            {empleados?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
          {errors.idEmpleado && (
            <p className="text-red-400 text-sm mt-1">{errors.idEmpleado.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="tarea-fechaCreacion">Fecha de Creación</Label>
          <Input id="tarea-fechaCreacion" type="date" {...register("fechaCreacion")} />
          {errors.fechaCreacion && (
            <p className="text-red-400 text-sm mt-1">{errors.fechaCreacion.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="tarea-fechaInicio">Fecha de Inicio</Label>
          <Input id="tarea-fechaInicio" type="date" {...register("fechaInicioTarea")} />
          {errors.fechaInicioTarea && (
            <p className="text-red-400 text-sm mt-1">{errors.fechaInicioTarea.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="tarea-fechaFin">Fecha de Finalización</Label>
          <Input id="tarea-fechaFin" type="date" {...register("fechaFinalizacion")} />
          {errors.fechaFinalizacion && (
            <p className="text-red-400 text-sm mt-1">{errors.fechaFinalizacion.message}</p>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {editMode ? "Actualizar" : "Crear"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void navigate("/tareas")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
