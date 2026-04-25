import { Link } from "react-router-dom";
import { useEmpleados } from "@/features/empleados/queries";
import { useEstados } from "@/features/estados/queries";
import { useTareas } from "@/features/tareas/queries";

function StatCard({
  title,
  count,
  href,
}: {
  title: string;
  count: number | undefined;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors"
    >
      <p className="text-3xl font-bold text-white mb-1">{count ?? "—"}</p>
      <p className="text-gray-400">{title}</p>
    </Link>
  );
}

export function Home() {
  const { data: empleados } = useEmpleados();
  const { data: estados } = useEstados();
  const { data: tareas } = useTareas();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">EmployeeK</h1>
      <p className="text-gray-400 mb-8">Sistema de gestión de empleados y tareas</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Empleados" count={empleados?.length} href="/empleados" />
        <StatCard title="Estados" count={estados?.length} href="/estados" />
        <StatCard title="Tareas" count={tareas?.length} href="/tareas" />
      </div>
    </div>
  );
}
