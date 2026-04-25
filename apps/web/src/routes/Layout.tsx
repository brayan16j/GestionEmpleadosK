import { Link, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex gap-6">
        <Link to="/" className="text-white font-bold text-lg">
          EmployeeK
        </Link>
        <div className="flex gap-4 items-center ml-4">
          <Link to="/empleados" className="text-gray-300 hover:text-white transition-colors">
            Empleados
          </Link>
          <Link to="/estados" className="text-gray-300 hover:text-white transition-colors">
            Estados
          </Link>
          <Link to="/tareas" className="text-gray-300 hover:text-white transition-colors">
            Tareas
          </Link>
        </div>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
