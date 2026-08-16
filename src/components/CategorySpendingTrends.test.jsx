import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CategorySpendingTrends } from "./CategorySpendingTrends.jsx";
import { buildStyles } from "../styles/buildStyles.js";

const styles = buildStyles("light", true);
const category = (id, name, colour = "#7FB069") => ({ id, name, colour, type: "expense" });
const tx = (id, date, amount, categoryId) => ({ id, date, amount, categoryId, type: "expense" });

const categories = [
  category("c-groceries", "Groceries"),
  category("c-electricity", "Electricity", "#C27B3F"),
  category("c-fuel", "Fuel"),
  category("c-health", "Health"),
  category("c-rates", "Rates"),
  category("c-water", "Water"),
];

function renderTrends(extra = {}) {
  const props = {
    transactions: [
      tx("g-apr", "2026-04-12", 8000, "c-groceries"),
      tx("g-may", "2026-05-12", 5000, "c-groceries"),
      tx("g-jun", "2026-06-12", 7500, "c-groceries"),
      tx("e-jun", "2026-06-14", 4000, "c-electricity"),
    ],
    categories,
    activeMonth: "2026-06",
    onNavigateToCategory: jest.fn(),
    styles,
    ...extra,
  };
  return { ...render(<CategorySpendingTrends {...props} />), props };
}

describe("per-category spending trends", () => {
  test("opens on five months with an explicit spending-versus-budget limit", () => {
    renderTrends();

    expect(screen.getByRole("button", { name: "5 months" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/does not yet retain past budget amounts/i)).toBeInTheDocument();
    const groceries = screen.getByTestId("category-spending-c-groceries");
    expect(within(groceries).getByRole("img", { name: "Groceries spending by month" })).toBeInTheDocument();
    expect(within(groceries).getAllByTestId(/^spending-bar-/)).toHaveLength(5);
    expect(within(groceries).getByTestId("category-change-c-groceries")).toHaveTextContent("Up $25.00 (50%) from last month");
  });

  test("the one-year control renders all twelve calendar months on a phone", () => {
    renderTrends();
    fireEvent.click(screen.getByRole("button", { name: "1 year" }));

    expect(screen.getByRole("button", { name: "1 year" })).toHaveAttribute("aria-pressed", "true");
    const groceries = screen.getByTestId("category-spending-c-groceries");
    expect(within(groceries).getAllByTestId(/^spending-bar-/)).toHaveLength(12);
    expect(within(groceries).getByTestId("spending-bar-2025-07")).toHaveAttribute("data-value", "0");
    expect(within(groceries).getByTestId("spending-bar-2026-06")).toHaveAttribute("data-value", "7500");
  });

  test("shows one chart at a time and lets the user choose another category", () => {
    renderTrends();

    expect(screen.getByRole("combobox", { name: "Category to chart" })).toHaveValue("c-groceries");
    expect(screen.getAllByTestId(/^category-spending-c-/)).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Category to chart" }), { target: { value: "c-electricity" } });
    expect(screen.queryByTestId("category-spending-c-groceries")).not.toBeInTheDocument();
    expect(screen.getByTestId("category-spending-c-electricity")).toBeInTheDocument();
  });

  test("a category section drills through to its transaction history", () => {
    const { props } = renderTrends();
    const groceries = screen.getByTestId("category-spending-c-groceries");
    fireEvent.click(within(groceries).getByRole("button", { name: "View entries" }));
    expect(props.onNavigateToCategory).toHaveBeenCalledWith("c-groceries");
  });

  test("an envelope with no spending gets an honest compact state, not a made-up chart scale", () => {
    renderTrends();
    fireEvent.change(screen.getByRole("combobox", { name: "Category to chart" }), { target: { value: "c-fuel" } });
    const fuel = screen.getByTestId("category-spending-c-fuel");
    expect(within(fuel).getByRole("img", { name: /Fuel spending by month: no spending/i })).toHaveTextContent("No spending in this period");
    expect(within(fuel).queryByText("$1.00")).not.toBeInTheDocument();
  });
});
