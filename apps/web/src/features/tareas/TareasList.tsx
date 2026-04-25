import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTareas, useDeleteTarea } from "./queries";
import { useEstados } from "@/features/estados/queries";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiProblem } from "@/lib/problem";

export function TareasList() {
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { data: tareas, isLoading } = useTareas(categoria);
  const { data: estados } = useEstados();
  const deleteMutation = useDeleteTarea();

  const categorias = [...new Set(estados?.map((e) => e.categoria) ?? [])];

  const handleDelete = () => {
    if (confirmId === null) return;
    deleteMutation.mutate(confirmId, {
      onSuccess: () => {
        toast.success("Tarea eliminada");
        setConfirmId(null);
      },
      onError: (err) => {
        setConfirmId(null);
        if (err instanceof ApiProblem) {
          toast.error(err.title, { description: err.detail });
        } else {
          toast.error("Error al eliminar tarea");
        }
      },
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tareas</h1>
        <Link
          to="/tareas/nuevo"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 py-2 px-4 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Nueva
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-400">Filtrar por categoría:</label>
        <Select
          value={categoria ?? ""}
          onChange={(e) => setCategoria(e.target.value || undefined)}
          className="w-48"
        >
          <option value="">Todas</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha Fin</TableHead>
            <TableHead>Acciones</TableHead>
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
              <TableCell>{t.empleadoNombre ?? t.idEmpleado}</TableCell>
              <TableCell>{t.estadoNombre ?? "—"}</TableCell>
              <TableCell>{t.fechaFinalizacion}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link
                    to={`/tareas/${t.id}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-gray-600 hover:bg-gray-800 text-gray-200 transition-colors"
                  >
                    Ver
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmId(t.id)}>
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {tareas?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400">
                No hay tareas
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tarea?</DialogTitle>
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
