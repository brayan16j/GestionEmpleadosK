import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/helpers/renderWithProviders";
import { TareasList } from "@/features/tareas/TareasList";
import { TareaForm } from "@/features/tareas/TareaForm";

vi.mock("@/lib/http", () => ({
  http: vi.fn(),
}));

import { http } from "@/lib/http";
const mockHttp = vi.mocked(http);

const mockEstados = [
  { id: 1, nombre: "pendiente", categoria: "activa", cambiosPermitidos: "en-progreso" },
];
const mockEmpleados = [
  {
    id: 1,
    nombre: "Ana García",
    fechaIngreso: "2024-01-15",
    salario: "50000",
    createdAt: "",
    updatedAt: "",
  },
];
const mockTareas = [
  {
    id: 1,
    nombre: "Implementar login",
    fechaCreacion: "2024-01-15",
    fechaInicioTarea: "2024-01-16",
    fechaFinalizacion: "2024-01-31",
    idEmpleado: 1,
    idEstado: 1,
    empleadoNombre: "Ana García",
    estadoNombre: "pendiente",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TareasList", () => {
  it("renders tareas with empleado and estado names", async () => {
    mockHttp.mockResolvedValueOnce(mockTareas); // listTareas
    mockHttp.mockResolvedValueOnce(mockEstados); // listEstados for filter
    renderWithProviders(<TareasList />);
    await waitFor(() => {
      expect(screen.getByText("Implementar login")).toBeInTheDocument();
    });
    expect(screen.getByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("pendiente")).toBeInTheDocument();
  });
});

describe("TareaForm — create", () => {
  it("omits estadoNombre from POST body when not selected", async () => {
    const user = userEvent.setup();

    // Mock per URL: useTarea(0) fires first, then useEmpleados
    mockHttp.mockImplementation((method: string, path: string, _body?: unknown) => {
      if (method === "GET" && path === "/tareas/0") return Promise.resolve(undefined);
      if (method === "GET" && path === "/empleados") return Promise.resolve(mockEmpleados);
      if (method === "POST" && path === "/tareas") {
        return Promise.resolve({
          id: 2,
          nombre: "Nueva tarea",
          fechaCreacion: "2024-02-01",
          fechaInicioTarea: "2024-02-02",
          fechaFinalizacion: "2024-02-28",
          idEmpleado: 1,
          idEstado: 1,
          estadoNombre: "pendiente",
        });
      }
      return Promise.resolve(undefined);
    });

    renderWithProviders(<TareaForm />, { initialEntries: ["/tareas/nuevo"] });

    expect(await screen.findByLabelText("Empleado")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre"), "Nueva tarea");
    await userEvent.selectOptions(screen.getByLabelText("Empleado"), "1");
    await user.type(screen.getByLabelText("Fecha de Creación"), "2024-02-01");
    await user.type(screen.getByLabelText("Fecha de Inicio"), "2024-02-02");
    await user.type(screen.getByLabelText("Fecha de Finalización"), "2024-02-28");

    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      const call = mockHttp.mock.calls.find((c) => c[0] === "POST" && c[1] === "/tareas");
      expect(call).toBeDefined();
      const body = call?.[2] as Record<string, unknown>;
      expect(body?.estadoNombre).toBeUndefined();
    });
  });
});
