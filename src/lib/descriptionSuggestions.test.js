import { descriptionSuggestions } from "./descriptionSuggestions.js";

const tx = (description, type = "expense") => ({ description, type });

test("suggests household descriptions by prefix, frequency and recency", () => {
  const history = [tx("Coffee Club"), tx("Shein"), tx("Coffee Club"), tx("Corner coffee"), tx("Coffee Cart")];
  expect(descriptionSuggestions(history, "cof")).toEqual(["Coffee Club", "Coffee Cart", "Corner coffee"]);
});

test("deduplicates case-insensitively, excludes exact text and respects transaction type", () => {
  const history = [tx("SHEIN"), tx("Shein"), tx("Shein salary", "income")];
  expect(descriptionSuggestions(history, "sh", { type: "expense" })).toEqual(["Shein"]);
  expect(descriptionSuggestions(history, "shein", { type: "expense" })).toEqual([]);
  expect(descriptionSuggestions(history, "", { type: "expense" })).toEqual([]);
});
