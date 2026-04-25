import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Guardar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards ref", () => {
    let ref: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          ref = el;
        }}
      >
        OK
      </Button>,
    );
    expect(ref).not.toBeNull();
  });
});

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Nombre" />);
    expect(screen.getByPlaceholderText("Nombre")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("forwards ref", () => {
    let ref: HTMLInputElement | null = null;
    render(
      <Input
        ref={(el) => {
          ref = el;
        }}
      />,
    );
    expect(ref).not.toBeNull();
  });
});

describe("Label", () => {
  it("renders children", () => {
    render(<Label>Nombre</Label>);
    expect(screen.getByText("Nombre")).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("renders options", () => {
    render(
      <Select>
        <option value="a">Opción A</option>
        <option value="b">Opción B</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Select disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
