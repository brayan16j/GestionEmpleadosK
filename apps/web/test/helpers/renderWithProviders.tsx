import { type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactNode,
  { initialEntries = ["/"] }: { initialEntries?: string[] } = {},
): RenderResult {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}
