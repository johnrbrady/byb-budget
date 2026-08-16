import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Root } from "./main.jsx";

jest.mock("./xlsx-helpers.js", () => ({
  exportToXlsx: jest.fn(),
  importFromXlsx: jest.fn(),
}));

jest.mock("./BudgetApp.jsx", () => {
  const React = require("react");

  return function MockBudgetApp({ initialData, onSave }) {
    const initialDescription = initialData?.transactions?.[0]?.description || "empty server";
    const [description, setDescription] = React.useState(initialDescription);

    const save = (nextDescription) => {
      setDescription(nextDescription);
      onSave({
        transactions: [{ id: "tx-local", description: nextDescription }],
        categories: [],
        recurring: [],
        users: [],
        unallocatedBalance: 0,
        assets: [],
        transfers: [],
        reconcileLog: [],
        adjustments: [],
      });
    };

    return (
      <div>
        <div data-testid="draft-description">{description}</div>
        <button type="button" onClick={() => save("first local edit")}>Save first edit</button>
        <button type="button" onClick={() => save("newer local edit")}>Save newer edit</button>
      </div>
    );
  };
});

const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: jest.fn().mockResolvedValue(body),
});

const serverData = (description, dataVersion) => ({
  transactions: [{ id: "tx-server", description }],
  categories: [],
  recurring: [],
  users: [],
  unallocatedBalance: 0,
  assets: [],
  transfers: [],
  reconcileLog: [],
  adjustments: [],
  dataVersion,
});

const flushOnPageHide = () => {
  fireEvent(window, new Event("pagehide"));
};

beforeEach(() => {
  localStorage.setItem("byb_token", "test-token");
  global.fetch = jest.fn();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

test("a 409 keeps the newest in-flight local edit visible until explicit discard", async () => {
  let finishFirstPost;
  fetch
    .mockResolvedValueOnce(response(200, serverData("server initial", 3)))
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirstPost = resolve; }))
    .mockResolvedValueOnce(response(200, serverData("server winner", 4)));

  render(<Root />);
  expect(await screen.findByTestId("draft-description")).toHaveTextContent("server initial");

  fireEvent.click(screen.getByRole("button", { name: "Save first edit" }));
  flushOnPageHide();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

  // This edit happens while the stale POST is still in flight. It is the draft
  // most at risk of being replaced by the failed request's older payload.
  fireEvent.click(screen.getByRole("button", { name: "Save newer edit" }));
  flushOnPageHide();
  expect(screen.getByTestId("draft-description")).toHaveTextContent("newer local edit");

  await act(async () => {
    finishFirstPost(response(409, { error: "conflict", dataVersion: 4 }));
  });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Another person saved changes. Your changes are still on screen but have not been saved."
  );
  expect(screen.getByTestId("draft-description")).toHaveTextContent("newer local edit");
  expect(fetch).toHaveBeenCalledTimes(2); // initial GET + one rejected POST; no silent reload or retry

  fireEvent.click(screen.getByRole("button", {
    name: "Discard my unsaved changes and reload latest",
  }));

  await waitFor(() => {
    expect(screen.getByTestId("draft-description")).toHaveTextContent("server winner");
  });
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[2][0]).toBe("/api/data");
  expect(fetch.mock.calls[2][1]).not.toHaveProperty("method");
});

test("a newer edit waits for the in-flight save and uses its returned version", async () => {
  let finishFirstPost;
  fetch
    .mockResolvedValueOnce(response(200, serverData("server initial", 7)))
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirstPost = resolve; }))
    .mockResolvedValueOnce(response(200, { ok: true, dataVersion: 9 }));

  render(<Root />);
  await screen.findByText("server initial");

  fireEvent.click(screen.getByRole("button", { name: "Save first edit" }));
  flushOnPageHide();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole("button", { name: "Save newer edit" }));
  flushOnPageHide();
  expect(fetch).toHaveBeenCalledTimes(2);

  await act(async () => {
    finishFirstPost(response(200, { ok: true, dataVersion: 8 }));
  });

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  const firstBody = JSON.parse(fetch.mock.calls[1][1].body);
  const secondBody = JSON.parse(fetch.mock.calls[2][1].body);
  expect(firstBody.transactions[0].description).toBe("first local edit");
  expect(firstBody.dataVersion).toBe(7);
  expect(secondBody.transactions[0].description).toBe("newer local edit");
  expect(secondBody.dataVersion).toBe(8);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a network failure is visible, retains the draft and recovers on a bounded retry", async () => {
  fetch
    .mockResolvedValueOnce(response(200, serverData("server initial", 12)))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response(200, { ok: true, dataVersion: 13 }));

  render(<Root />);
  await screen.findByText("server initial");
  fireEvent.click(screen.getByRole("button", { name: "Save first edit" }));
  flushOnPageHide();

  const alert = await screen.findByTestId("save-failure");
  expect(alert).toHaveTextContent("Your changes are still on screen");
  expect(screen.getByTestId("draft-description")).toHaveTextContent("first local edit");
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByTestId("save-failure")).not.toBeInTheDocument());
  expect(JSON.parse(fetch.mock.calls[1][1].body).dataVersion).toBe(12);
  expect(JSON.parse(fetch.mock.calls[2][1].body).dataVersion).toBe(12);
});

test("5xx retries stop after two attempts and the explicit retry remains safe", async () => {
  fetch
    .mockResolvedValueOnce(response(200, serverData("server initial", 20)))
    .mockResolvedValueOnce(response(503, { error: "unavailable" }))
    .mockResolvedValueOnce(response(503, { error: "unavailable" }))
    .mockResolvedValueOnce(response(503, { error: "unavailable" }))
    .mockResolvedValueOnce(response(200, { ok: true, dataVersion: 21 }));

  render(<Root />);
  await screen.findByText("server initial");
  fireEvent.click(screen.getByRole("button", { name: "Save first edit" }));
  flushOnPageHide();

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4)); // GET + initial POST + two retries
  expect(await screen.findByTestId("save-failure")).toHaveTextContent("could not save after two retries");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  expect(fetch).toHaveBeenCalledTimes(4);

  fireEvent.click(screen.getByRole("button", { name: "Retry save now" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
  await waitFor(() => expect(screen.queryByTestId("save-failure")).not.toBeInTheDocument());
  expect(JSON.parse(fetch.mock.calls[4][1].body)).toMatchObject({ dataVersion: 20, transactions: [{ description: "first local edit" }] });
});
