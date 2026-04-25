import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/helpers/renderWithProviders";
import { EstadosList } from "@/features/estados/EstadosList";
import { EstadoForm } from "@/features/estados/EstadoForm";
import { ApiProblem } from "@/lib/problem";

vi.mock("@/lib/http", () => ({
  http: vi.fn(),
}));

import { http } from "@/lib/http";
const mockHttp = vi.mocked(http);

const mockEstados = [
  { id: 1, nombre: "pendiente", categoria: "activa", cambiosPermitidos: "en-progreso" },
  { id: 2, nombre: "en-progreso", categoria: "activa", cambiosPermitidos: "finalizada" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EstadosList", () => {
  it("renders estados rows", async () => {
    mockHttp.mockResolvedValueOnce(mockEstados);
    renderWithProviders(<EstadosList />);
    await waitFor(() => {
      expect(screen.getByText("pendiente")).toBeInTheDocument();
    });
    // "en-progreso" appears in both nombre column and cambiosPermitidos column
    expect(screen.getAllByText("en-progreso").length).toBeGreaterThan(0);
  });

  it("shows 422 toast when deleting an estado in use", async () => {
    const user = userEvent.setup();
    mockHttp.mockResolvedValueOnce(mockEstados);
    renderWithProviders(<EstadosList />);

    await screen.findByText("pendiente");

    const deleteBtns = screen.getAllByRole("button", { name: "Eliminar" });
    await user.click(deleteBtns[0]!);

    // Confirm dialog
    const confirmBtn = screen.getAllByRole("button", { name: "Eliminar" }).at(-1)!;
    mockHttp.mockRejectedValueOnce(
      new ApiProblem({
        type: "https://example.com/unprocessable",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Estado is in use",
        traceId: "trace-xyz",
      }),
    );
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Unprocessable Entity")).toBeInTheDocument();
    });
  });
});

describe("EstadoForm — create", () => {
  it("calls POST /estados with expected body on happy path", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockHttp.mockResolvedValueOnce({
      id: 3,
      nombre: "nuevo-estado",
      categoria: "activa",
      cambiosPermitidos: null,
    });

    renderWithProviders(<EstadoForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Nombre"), "nuevo-estado");
    await user.type(screen.getByLabelText("Categoría"), "activa");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(mockHttp).toHaveBeenCalledWith(
        "POST",
        "/estados",
        expect.objectContaining({
          nombre: "nuevo-estado",
          categoria: "activa",
        }),
      );
    });
  });

  it("shows 409 toast when nombre is duplicated", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockHttp.mockRejectedValueOnce(
      new ApiProblem({
        type: "https://example.com/conflict",
        title: "Conflict",
        status: 409,
        detail: "A record with the same nombre already exists",
        traceId: "conflict-trace",
      }),
    );

    renderWithProviders(<EstadoForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Nombre"), "pendiente");
    await user.type(screen.getByLabelText("Categoría"), "activa");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(screen.getByText("Conflict")).toBeInTheDocument();
    });
  });
});
