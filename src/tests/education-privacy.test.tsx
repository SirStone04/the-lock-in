// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AppRecord } from "../domain/models";

const fixture = vi.hoisted(() => ({ records: [] as AppRecord[] }));
vi.mock("../data/store", () => ({
  useApp: () => ({ records: fixture.records, save: vi.fn(), remove: vi.fn() }),
}));
import Education from "../pages/Education";

beforeEach(() => { fixture.records = []; });
afterEach(() => cleanup());

describe("private education context", () => {
  it("shows unknown baseline and booking status without personal records", () => {
    render(<Education />);
    expect(screen.getByText("Not recorded")).toBeTruthy();
    expect(screen.getByText(/No current baseline is recorded/)).toBeTruthy();
    expect(screen.queryByText(/Private historical context:/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /research|school/i }));
    expect(screen.getByText("Research your nursing-school options")).toBeTruthy();
    expect(screen.getAllByText("Nothing logged yet")).toHaveLength(2);
  });
  it("displays historical context only from the private profile", () => {
    fixture.records = [{
      id: "settings-profile", kind: "settings", title: "Private profile",
      date: "2026-01-04", createdAt: "2026-01-04T12:00:00Z",
      updatedAt: "2026-01-04T12:00:00Z", revision: 1,
      data: { historicalAssessment: "Synthetic reference context", examStatus: "Booked" },
    }];
    render(<Education />);
    expect(screen.getByText("Booked")).toBeTruthy();
    expect(screen.getByText(/Private historical context: Synthetic reference context/)).toBeTruthy();
  });
});
