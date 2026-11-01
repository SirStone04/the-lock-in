// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { AppRecord, RecordInput } from "../domain/models";
import { addDays, today } from "../domain/dates";

const fixture = vi.hoisted(() => ({
  records: [] as AppRecord[],
  listeners: new Set<() => void>(),
  nextId: 0,
}));
vi.mock("../data/store", async () => {
  const React = await import("react");
  const save = async (input: RecordInput) => {
    const id = input.id ?? `record-${++fixture.nextId}`;
    const previous = fixture.records.find((r) => r.id === id);
    const record: AppRecord = {
      ...input,
      id,
      revision: (previous?.revision ?? 0) + 1,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fixture.records = [...fixture.records.filter((r) => r.id !== id), record];
    fixture.listeners.forEach((listener) => listener());
    return id;
  };
  return {
    useApp: () => ({
      records: React.useSyncExternalStore(
        (listener) => {
          fixture.listeners.add(listener);
          return () => {
            fixture.listeners.delete(listener);
          };
        },
        () => fixture.records,
      ),
      save,
      remove: async (id: string) => {
        fixture.records = fixture.records.filter((r) => r.id !== id);
        fixture.listeners.forEach((listener) => listener());
      },
    }),
  };
});
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: import("react").ReactNode;
    }) => <div>{children}</div>,
  };
});
import Fitness from "../pages/Fitness";
import Education from "../pages/Education";

beforeEach(() => {
  fixture.records = [];
  fixture.nextId = 0;
  fixture.listeners.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => cleanup());

describe("fitness logging workflow", () => {
  it("saves and corrects a set without duplication, then resumes its session after reopening", async () => {
    const view = render(<Fitness />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Start workout" })[0],
    );
    const weight = await screen.findByLabelText("Chest Press set 1 weight");
    const row = weight.closest(".set-editor") as HTMLElement;
    fireEvent.change(weight, { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Chest Press set 1 repetitions"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Chest Press set 1 RPE"), {
      target: { value: "8" },
    });
    fireEvent.click(within(row).getByRole("checkbox", { name: "Completed" }));
    fireEvent.click(within(row).getByRole("button", { name: "Save set" }));
    await waitFor(() =>
      expect(
        fixture.records.filter((r) => r.kind === "exerciseSet"),
      ).toHaveLength(1),
    );
    const originalId = fixture.records.find(
      (r) => r.kind === "exerciseSet",
    )!.id;
    await within(row).findByRole("button", { name: "Save changes" });
    fireEvent.change(screen.getByLabelText("Chest Press set 1 weight"), {
      target: { value: "105" },
    });
    fireEvent.click(within(row).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        fixture.records.find((r) => r.id === originalId)?.data.weight,
      ).toBe(105),
    );
    expect(
      fixture.records.filter((r) => r.kind === "exerciseSet"),
    ).toHaveLength(1);
    expect(fixture.records.find((r) => r.id === originalId)?.revision).toBe(2);
    view.unmount();
    render(<Fitness />);
    expect(
      (screen.getByLabelText("Chest Press set 1 weight") as HTMLInputElement)
        .value,
    ).toBe("105");
    expect(
      (
        screen.getByLabelText(
          "Chest Press set 1 repetitions",
        ) as HTMLInputElement
      ).value,
    ).toBe("10");
    expect(
      fixture.records.filter((r) => r.kind === "workout" && !r.data.isTemplate),
    ).toHaveLength(1);
  });
});

describe("education assessment workflow", () => {
  it("rejects an impossible score and updates readiness from a valid fresh mixed assessment", async () => {
    fixture.records = [1, 2].map((i) => ({
      id: `assessment-${i}`,
      kind: "assessment",
      date: addDays(today(), -i),
      title: `Assessment ${i}`,
      data: { questions: 100, correct: 85, fresh: true, mixed: true },
      createdAt: `2026-10-2${i}T12:00:00Z`,
      updatedAt: `2026-10-2${i}T12:00:00Z`,
      revision: 1,
    }));
    render(<Education />);
    expect(screen.getByText("2/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Assessments" }));
    const section = screen
      .getByRole("heading", { name: "Practice assessments" })
      .closest("section") as HTMLElement;
    fireEvent.click(
      within(section).getByRole("button", { name: "Add record" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Questions attempted"), {
      target: { value: "100" },
    });
    fireEvent.change(
      within(dialog).getByLabelText("Correct answers (≤ attempted)"),
      { target: { value: "101" } },
    );
    fireEvent.click(
      within(dialog).getByLabelText("Fresh questions (not repeated)"),
    );
    fireEvent.click(within(dialog).getByLabelText("Mixed-topic assessment"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save record" }),
    );
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(fixture.records.filter((r) => r.kind === "assessment")).toHaveLength(
      2,
    );
    fireEvent.change(
      within(dialog).getByLabelText("Correct answers (≤ attempted)"),
      { target: { value: "90" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save record" }),
    );
    await waitFor(() => expect(screen.getByText("3/3")).toBeTruthy());
    expect(screen.getByText("Readiness target reached")).toBeTruthy();
    expect(fixture.records.filter((r) => r.kind === "assessment")).toHaveLength(
      3,
    );
  });
});
