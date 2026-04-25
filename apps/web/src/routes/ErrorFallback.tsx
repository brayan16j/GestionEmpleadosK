import { useRouteError, Link } from "react-router-dom";
import { ApiProblem } from "@/lib/problem";

export function ErrorFallback() {
  const error = useRouteError();

  if (error instanceof ApiProblem) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2 text-red-400">
          {error.status} — {error.title}
        </h1>
        {error.detail && <p className="text-gray-300 mb-2">{error.detail}</p>}
        <p className="text-xs text-gray-500 mb-6">traceId: {error.traceId}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-400 hover:underline mr-4"
        >
          Recargar
        </button>
        <Link to="/" className="text-blue-400 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2 text-red-400">Algo salió mal</h1>
      <p className="text-gray-400 mb-6">Ocurrió un error inesperado.</p>
      <button onClick={() => window.location.reload()} className="text-blue-400 hover:underline">
        Recargar
      </button>
    </div>
  );
}
