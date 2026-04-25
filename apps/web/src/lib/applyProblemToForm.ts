import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { ApiProblem } from "./problem";

export function applyProblemToForm<T extends FieldValues>(
  problem: ApiProblem,
  form: UseFormReturn<T>,
): boolean {
  if (!problem.errors || problem.errors.length === 0) {
    return false;
  }

  let mapped = false;
  for (const err of problem.errors) {
    // "body/fieldName" → "fieldName"
    const field = err.path.replace(/^body\//, "") as Path<T>;
    form.setError(field, { type: "server", message: err.message });
    mapped = true;
  }

  return mapped;
}
