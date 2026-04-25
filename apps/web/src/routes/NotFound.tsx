import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-gray-400 mb-6">Página no encontrada.</p>
      <Link to="/" className="text-blue-400 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
