import { useNavigate } from "react-router-dom";
import { EstadoForm } from "./EstadoForm";

export function EstadoNew() {
  const navigate = useNavigate();
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nuevo Estado</h1>
      <EstadoForm onSuccess={() => void navigate("/estados")} />
    </div>
  );
}
