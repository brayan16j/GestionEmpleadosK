import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useTarea, useDeleteTarea } from "./queries";
import { CambiarEstadoDialog } from "./CambiarEstadoDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiProblem } from "@/lib/problem";
import { TareaForm } from "./TareaForm";

export function TareaDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cambiarEstadoOpen, setCambiarEstadoOpen] = useState(false);

  const { data: tarea, isLoading } = useTarea(numericId);
  const deleteMutation = useDeleteTarea();

  const handleDelete = () => {
    deleteMutation.mutate(numericId, {
      onSuccess: () => {
        toast.success("Tarea eliminada");
        void navigate("/tareas");
      },
      onError: (err) => {
        setConfirmDelete(false);
        if (err instanceof ApiProblem) {
          toast.error(err.title, { description: err.detail });
        } else {
          toast.error("Error al eliminar tarea");
        }
      },
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;
  if (!tarea) return <div className="p-6 text-gray-400">Tarea no encontrada</div>;

  if (editMode) return <TareaForm editMode />;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{tarea.nombre}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditMode(true)}>
            Editar
          </Button>
          <Button onClick={() => setCambiarEstadoOpen(true)}>Cambiar Estado</Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-gray-300">
        <p>
          <span className="text-gray-400 mr-2">ID:</span>
          {tarea.id}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Empleado:</span>
          {tarea.empleadoNombre ? (
            <Link to={`/empleados/${tarea.idEmpleado}`} className="text-blue-400 hover:underline">
              {tarea.empleadoNombre}
            </Link>
          ) : (
            tarea.idEmpleado
          )}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Estado:</span>
          {tarea.estadoNombre ?? "—"}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Fecha Creación:</span>
          {tarea.fechaCreacion}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Fecha Inicio:</span>
          {tarea.fechaInicioTarea}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Fecha Finalización:</span>
          {tarea.fechaFinalizacion}
        </p>
      </div>

      <CambiarEstadoDialog
        tarea={tarea}
        open={cambiarEstadoOpen}
        onOpenChange={setCambiarEstadoOpen}
      />

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tarea?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
