import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createEmpleadoSchema, type CreateEmpleadoInput } from "./schemas";
import { useCreateEmpleado, useUpdateEmpleado, useEmpleado } from "./queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiProblem } from "@/lib/problem";
import { applyProblemToForm } from "@/lib/applyProblemToForm";

interface EmpleadoFormProps {
  editMode?: boolean;
}

export function EmpleadoForm({ editMode = false }: EmpleadoFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : undefined;

  const { data: empleado } = useEmpleado(numericId ?? 0);
  const createMutation = useCreateEmpleado();
  const updateMutation = useUpdateEmpleado(numericId ?? 0);

  const form = useForm<CreateEmpleadoInput>({
    resolver: zodResolver(createEmpleadoSchema),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (editMode && empleado) {
      reset({
        nombre: empleado.nombre,
        fechaIngreso: empleado.fechaIngreso,
        salario: Number(empleado.salario),
      });
    }
  }, [editMode, empleado, reset]);

  const onSubmit = async (data: CreateEmpleadoInput) => {
    const mutation = editMode && numericId ? updateMutation : createMutation;
    mutation.mutate(data as Parameters<typeof mutation.mutate>[0], {
      onSuccess: () => {
        toast.success(editMode ? "Empleado actualizado" : "Empleado creado");
        void navigate("/empleados");
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
      <h1 className="text-2xl font-bold mb-6">{editMode ? "Editar Empleado" : "Nuevo Empleado"}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} placeholder="Nombre completo" />
          {errors.nombre && <p className="text-red-400 text-sm mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
          <Input id="fechaIngreso" type="date" {...register("fechaIngreso")} />
          {errors.fechaIngreso && (
            <p className="text-red-400 text-sm mt-1">{errors.fechaIngreso.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="salario">Salario</Label>
          <Input
            id="salario"
            type="number"
            step="0.01"
            {...register("salario")}
            placeholder="0.00"
          />
          {errors.salario && <p className="text-red-400 text-sm mt-1">{errors.salario.message}</p>}
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {editMode ? "Actualizar" : "Crear"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void navigate("/empleados")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
