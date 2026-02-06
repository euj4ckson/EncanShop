import { render, screen } from "@testing-library/react";
import { CartBadge } from "@/components/CartBadge";

describe("CartBadge", () => {
  it("renders count when greater than zero", () => {
    render(<CartBadge count={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not render when count is zero", () => {
    render(<CartBadge count={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
