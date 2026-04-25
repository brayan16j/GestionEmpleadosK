import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/helpers/renderWithProviders";
import { EmpleadosList } from "@/features/empleados/EmpleadosList";
import { EmpleadoForm } from "@/features/empleados/EmpleadoForm";
import { ApiProblem } from "@/lib/problem";

vi.mock("@/lib/http", () => ({
  http: vi.fn(),
}));

import { http } from "@/lib/http";
const mockHttp = vi.mocked(http);

const mockEmpleados = [
  {
    id: 1,
    nombre: "Ana García",
    fechaIngreso: "2024-01-15",
    salario: "50000",
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmpleadosList", () => {
  it("renders empleados rows from the API", async () => {
    mockHttp.mockResolvedValueOnce(mockEmpleados);
    renderWithProviders(<EmpleadosList />);
    await waitFor(() => {
      expect(screen.getByText("Ana García")).toBeInTheDocument();
    });
    expect(screen.getByText("50000")).toBeInTheDocument();
  });

  it("shows a 422 toast when deleting an empleado with tareas", async () => {
    const user = userEvent.setup();
    mockHttp.mockResolvedValueOnce(mockEmpleados);
    renderWithProviders(<EmpleadosList />);

    await screen.findByText("Ana García");

    const deleteBtn = screen.getByRole("button", { name: "Eliminar" });
    await user.click(deleteBtn);

    // Confirm the delete dialog
    const confirmBtn = screen.getAllByRole("button", { name: "Eliminar" }).at(-1)!;
    mockHttp.mockRejectedValueOnce(
      new ApiProblem({
        type: "https://example.com/unprocessable",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Foreign key constraint failed on foreign key",
        traceId: "xyz-789",
      }),
    );
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Unprocessable Entity")).toBeInTheDocument();
    });
  });
});

describe("EmpleadoForm — create", () => {
  it("calls POST /empleados with expected body on happy path", async () => {
    const user = userEvent.setup();
    mockHttp.mockResolvedValueOnce({
      id: 2,
      nombre: "Carlos López",
      fechaIngreso: "2024-06-01",
      salario: "60000",
      createdAt: "2024-06-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
    });

    renderWithProviders(<EmpleadoForm />, { initialEntries: ["/empleados/nuevo"] });

    await user.type(screen.getByLabelText("Nombre"), "Carlos López");
    await user.type(screen.getByLabelText("Fecha de Ingreso"), "2024-06-01");
    await user.type(screen.getByLabelText("Salario"), "60000");

    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(mockHttp).toHaveBeenCalledWith("POST", "/empleados", {
        nombre: "Carlos López",
        fechaIngreso: "2024-06-01",
        salario: 60000,
      });
    });
  });

  it("maps body/salario API error to salario field", async () => {
    const user = userEvent.setup();

    renderWithProviders(<EmpleadoForm />, { initialEntries: ["/empleados/nuevo"] });

    // Wait for component to stabilize (initial useEmpleado(0) query fires and resolves)
    expect(await screen.findByRole("button", { name: "Crear" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre"), "Test");
    await user.type(screen.getByLabelText("Fecha de Ingreso"), "2024-01-01");
    // Use 0 which passes Zod min(0) but simulate server returning an error for it
    await user.type(screen.getByLabelText("Salario"), "0");

    // Set rejection mock AFTER initial queries have fired
    mockHttp.mockRejectedValueOnce(
      new ApiProblem({
        type: "https://example.com/validation",
        title: "Bad Request",
        status: 400,
        traceId: "abc-123",
        errors: [{ path: "body/salario", message: "must be >= 0" }],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(screen.getByText("must be >= 0")).toBeInTheDocument();
    });
  });
});
