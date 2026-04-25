import { describe, it, expect, vi } from "vitest";
import { applyProblemToForm } from "@/lib/applyProblemToForm";
import { ApiProblem } from "@/lib/problem";
import type { UseFormReturn, FieldValues } from "react-hook-form";

function makeForm(): UseFormReturn<FieldValues> {
  const setError = vi.fn();
  return { setError } as unknown as UseFormReturn<FieldValues>;
}

const baseEnvelope = {
  type: "https://example.com/validation",
  title: "Bad Request",
  status: 400,
  traceId: "abc-123",
};

describe("applyProblemToForm()", () => {
  it("maps body/fieldName errors onto form fields", () => {
    const problem = new ApiProblem({
      ...baseEnvelope,
      errors: [{ path: "body/salario", message: "must be >= 0" }],
    });
    const form = makeForm();
    const result = applyProblemToForm(problem, form);
    expect(result).toBe(true);
    expect(form.setError).toHaveBeenCalledWith("salario", {
      type: "server",
      message: "must be >= 0",
    });
  });

  it("maps multiple errors onto their respective fields", () => {
    const problem = new ApiProblem({
      ...baseEnvelope,
      errors: [
        { path: "body/nombre", message: "required" },
        { path: "body/salario", message: "must be >= 0" },
      ],
    });
    const form = makeForm();
    applyProblemToForm(problem, form);
    expect(form.setError).toHaveBeenCalledTimes(2);
    expect(form.setError).toHaveBeenCalledWith("nombre", { type: "server", message: "required" });
    expect(form.setError).toHaveBeenCalledWith("salario", {
      type: "server",
      message: "must be >= 0",
    });
  });

  it("returns false when no errors[] present", () => {
    const problem = new ApiProblem({ ...baseEnvelope });
    const form = makeForm();
    const result = applyProblemToForm(problem, form);
    expect(result).toBe(false);
    expect(form.setError).not.toHaveBeenCalled();
  });

  it("returns false when errors[] is empty", () => {
    const problem = new ApiProblem({ ...baseEnvelope, errors: [] });
    const form = makeForm();
    const result = applyProblemToForm(problem, form);
    expect(result).toBe(false);
  });
});
