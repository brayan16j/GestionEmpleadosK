import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useEmpleado, useDeleteEmpleado, useEmpleadoTareas } from "./queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ApiProblem } from "@/lib/problem";
import { EmpleadoForm } from "./EmpleadoForm";

export function EmpleadoDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: empleado, isLoading } = useEmpleado(numericId);
  const { data: tareas } = useEmpleadoTareas(numericId);
  const deleteMutation = useDeleteEmpleado();

  const handleDelete = () => {
    deleteMutation.mutate(numericId, {
      onSuccess: () => {
        toast.success("Empleado eliminado");
        void navigate("/empleados");
      },
      onError: (err) => {
        setConfirmDelete(false);
        if (err instanceof ApiProblem) {
          toast.error(err.title, { description: err.detail });
        } else {
          toast.error("Error al eliminar empleado");
        }
      },
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;
  if (!empleado) return <div className="p-6 text-gray-400">Empleado no encontrado</div>;

  if (editMode) {
    return <EmpleadoForm editMode />;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{empleado.nombre}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditMode(true)}>
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-8 text-gray-300">
        <p>
          <span className="text-gray-400 mr-2">ID:</span>
          {empleado.id}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Fecha de ingreso:</span>
          {empleado.fechaIngreso}
        </p>
        <p>
          <span className="text-gray-400 mr-2">Salario:</span>
          {empleado.salario}
        </p>
      </div>

      <h2 className="text-lg font-semibold mb-3">Tareas de este empleado</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha Fin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tareas?.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.id}</TableCell>
              <TableCell>
                <Link to={`/tareas/${t.id}`} className="text-blue-400 hover:underline">
                  {t.nombre}
                </Link>
              </TableCell>
              <TableCell>{t.estadoNombre ?? "—"}</TableCell>
              <TableCell>{t.fechaFinalizacion}</TableCell>
            </TableRow>
          ))}
          {(!tareas || tareas.length === 0) && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-400">
                Sin tareas
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar empleado?</DialogTitle>
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
