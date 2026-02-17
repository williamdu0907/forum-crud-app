/* @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import App from "../App.jsx";

function jsonResponse(body, { status = 200, ok = true } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (name) => (name && name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  globalThis.fetch = vi.fn((url) => {
    if (url.toString().includes("/api/me")) {
      return Promise.resolve(jsonResponse({ error: "Not logged in" }, { status: 401, ok: false }));
    }
    if (url.toString().includes("/api/comments")) {
      return Promise.resolve(jsonResponse([]));
    }
    return Promise.reject(new Error(`Unhandled request: ${url}`));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders the app shell and fetches initial data", async () => {
  render(<App />);

  expect(screen.getByText("Commment!")).toBeTruthy();

  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  expect(screen.getByText("Login to comment or rate")).toBeTruthy();
});
