import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { Home } from "./Home";
import { NotFound } from "./NotFound";
import { ErrorFallback } from "./ErrorFallback";
import { EmpleadosList } from "@/features/empleados/EmpleadosList";
import { EmpleadoForm } from "@/features/empleados/EmpleadoForm";
import { EmpleadoDetail } from "@/features/empleados/EmpleadoDetail";
import { EstadosList } from "@/features/estados/EstadosList";
import { EstadoNew } from "@/features/estados/EstadoNew";
import { TareasList } from "@/features/tareas/TareasList";
import { TareaForm } from "@/features/tareas/TareaForm";
import { TareaDetail } from "@/features/tareas/TareaDetail";

type BrowserRouter = ReturnType<typeof createBrowserRouter>;
export const router: BrowserRouter = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: <Home /> },
      { path: "empleados", element: <EmpleadosList /> },
      { path: "empleados/nuevo", element: <EmpleadoForm /> },
      { path: "empleados/:id", element: <EmpleadoDetail /> },
      { path: "estados", element: <EstadosList /> },
      { path: "estados/nuevo", element: <EstadoNew /> },
      { path: "tareas", element: <TareasList /> },
      { path: "tareas/nuevo", element: <TareaForm /> },
      { path: "tareas/:id", element: <TareaDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
