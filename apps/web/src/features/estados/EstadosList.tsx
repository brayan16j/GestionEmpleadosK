import { useState } from "react";
import { toast } from "sonner";
import { useEstados, useDeleteEstado } from "./queries";
import { EstadoForm } from "./EstadoForm";
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
import type { Estado } from "./api";

export function EstadosList() {
  const { data: estados, isLoading } = useEstados();
  const deleteMutation = useDeleteEstado();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editEstado, setEditEstado] = useState<Estado | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = () => {
    if (confirmId === null) return;
    deleteMutation.mutate(confirmId, {
      onSuccess: () => {
        toast.success("Estado eliminado");
        setConfirmId(null);
      },
      onError: (err) => {
        setConfirmId(null);
        if (err instanceof ApiProblem) {
          toast.error(err.title, { description: err.detail });
        } else {
          toast.error("Error al eliminar estado");
        }
      },
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Estados</h1>
        <Button onClick={() => setShowCreate(true)}>Nuevo</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Cambios Permitidos</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estados?.map((est) => (
            <TableRow key={est.id}>
              <TableCell>{est.id}</TableCell>
              <TableCell>{est.nombre}</TableCell>
              <TableCell>{est.categoria}</TableCell>
              <TableCell>{est.cambiosPermitidos ?? "—"}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditEstado(est)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmId(est.id)}>
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {estados?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-400">
                No hay estados registrados
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showCreate} onOpenChange={(o) => !o && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Estado</DialogTitle>
          </DialogHeader>
          <EstadoForm onSuccess={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editEstado !== null} onOpenChange={(o) => !o && setEditEstado(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Estado</DialogTitle>
          </DialogHeader>
          {editEstado && <EstadoForm estado={editEstado} onSuccess={() => setEditEstado(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar estado?</DialogTitle>
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
