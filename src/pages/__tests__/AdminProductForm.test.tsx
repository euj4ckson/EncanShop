import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminProductForm } from "@/components/AdminProductForm";

describe("AdminProductForm", () => {
  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<AdminProductForm onSubmit={() => {}} />);

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(screen.getByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Informe o preço")).toBeInTheDocument();
    expect(screen.getByText("Descreva o produto")).toBeInTheDocument();
  });
});
