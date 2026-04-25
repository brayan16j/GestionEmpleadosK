import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useEmpleados, useDeleteEmpleado } from "./queries";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiProblem } from "@/lib/problem";

export function EmpleadosList() {
  const { data: empleados, isLoading } = useEmpleados();
  const deleteMutation = useDeleteEmpleado();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleDelete = () => {
    if (confirmId === null) return;
    deleteMutation.mutate(confirmId, {
      onSuccess: () => {
        toast.success("Empleado eliminado");
        setConfirmId(null);
      },
      onError: (err) => {
        setConfirmId(null);
        if (err instanceof ApiProblem) {
          toast.error(err.title, { description: err.detail });
        } else {
          toast.error("Error al eliminar empleado");
        }
      },
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Empleados</h1>
        <Link
          to="/empleados/nuevo"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 py-2 px-4 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Nuevo
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Fecha Ingreso</TableHead>
            <TableHead>Salario</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empleados?.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell>{emp.id}</TableCell>
              <TableCell>
                <Link to={`/empleados/${emp.id}`} className="text-blue-400 hover:underline">
                  {emp.nombre}
                </Link>
              </TableCell>
              <TableCell>{emp.fechaIngreso}</TableCell>
              <TableCell>{emp.salario}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link
                    to={`/empleados/${emp.id}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-gray-600 hover:bg-gray-800 text-gray-200 transition-colors"
                  >
                    Ver
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmId(emp.id)}>
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {empleados?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-400">
                No hay empleados registrados
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar empleado?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
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
