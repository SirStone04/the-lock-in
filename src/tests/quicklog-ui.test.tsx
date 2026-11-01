// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AppRecord, Data, Kind, RecordInput } from "../domain/models";
import { today } from "../domain/dates";
import { financialTotals } from "../domain/calculations";
import QuickLog from "../components/QuickLog";

const state = vi.hoisted(() => ({ records: [] as AppRecord[], save: vi.fn() }));
vi.mock("../data/store", () => ({ useApp: () => state }));
// jsdom does not implement native modal-dialog lifecycle methods.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  writable: true,
  value() {
    this.setAttribute("open", "");
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  writable: true,
  value() {
    this.removeAttribute("open");
  },
});

function record(id: string, kind: Kind, data: Data, revision = 1): AppRecord {
  return {
    id,
    kind,
    data,
    date: today(),
    title: id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision,
  };
}
function persist(input: RecordInput) {
  const id = input.id ?? "generated-id";
  const old = state.records.find((r) => r.id === id);
  const next = {
    ...record(id, input.kind, input.data, (old?.revision ?? 0) + 1),
    title: input.title,
    date: input.date,
  };
  state.records = [...state.records.filter((r) => r.id !== id), next];
  return id;
}

beforeEach(() => {
  state.records = [];
  state.save.mockReset();
  state.save.mockImplementation(async (input: RecordInput) => persist(input));
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
    function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  );
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("central check-in shares canonical life-area records", () => {
  it("saves routines to their dedicated records and one actual ledger transaction", async () => {
    const date = today(),
      closed = vi.fn();
    state.records = [
      record("cash", "account", {
        reconciled: true,
        reconciledBalance: 300,
        reconciledThrough: date,
      }),
      record("prior-income", "transaction", {
        type: "income",
        amount: 200,
        toAccount: "cash",
      }),
    ];
    render(<QuickLog onClose={closed} />);
    fireEvent.click(screen.getByLabelText("Prayer completed"));
    fireEvent.click(screen.getByLabelText("Scripture read"));
    fireEvent.click(screen.getByLabelText("Breakfast"));
    fireEvent.click(screen.getByLabelText("AM skincare"));
    fireEvent.change(screen.getByLabelText("Water (oz)"), {
      target: { value: "48" },
    });
    fireEvent.change(screen.getByLabelText("New transaction amount ($)"), {
      target: { value: "12.50" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Actual groceries" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByLabelText("Account (optional)"), {
      target: { value: "cash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(state.records.find((r) => r.id === `faith-${date}`)).toMatchObject({
      kind: "faith",
      data: { prayer: true, scripture: true },
    });
    expect(
      state.records.find((r) => r.id === `nutrition-${date}`),
    ).toMatchObject({
      kind: "nutrition",
      data: { breakfast: true, water: 48 },
    });
    expect(
      state.records.find((r) => r.id === `skincare-${date}`),
    ).toMatchObject({ kind: "skincare", data: { am: true, pm: false } });
    expect(state.records.find((r) => r.id === `daily-${date}`)).toMatchObject({
      kind: "daily",
      data: { faith: true, breakfast: true, skincareAM: true },
    });
    const transactionCalls = state.save.mock.calls
      .map((call) => call[0] as RecordInput)
      .filter((r) => r.kind === "transaction");
    expect(transactionCalls).toHaveLength(1);
    expect(transactionCalls[0]).toMatchObject({
      data: {
        type: "expense",
        amount: 12.5,
        category: "Groceries",
        fromAccount: "cash",
      },
    });
    expect(financialTotals(state.records, date, date)).toMatchObject({
      income: 200,
      spending: 12.5,
    });
  });

  it("keeps current routine values and metadata when an older check-in snapshot disagrees", async () => {
    const date = today(),
      closed = vi.fn();
    state.records = [
      record(`daily-${date}`, "daily", {
        faith: false,
        breakfast: false,
        dinner: false,
        skincareAM: false,
        skincarePM: false,
        hydration: 8,
      }),
      record(
        `faith-${date}`,
        "faith",
        { prayer: true, scripture: true, church: true, duration: 30 },
        3,
      ),
      record(
        `nutrition-${date}`,
        "nutrition",
        {
          breakfast: true,
          lunch: false,
          dinner: true,
          snack: true,
          water: 64,
          protein: 90,
        },
        4,
      ),
      record(
        `skincare-${date}`,
        "skincare",
        { am: true, pm: true, irritation: 2 },
        2,
      ),
    ];
    render(<QuickLog onClose={closed} />);
    expect(
      (screen.getByLabelText("Prayer completed") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Breakfast") as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByLabelText("Dinner") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("AM skincare") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Water (oz)") as HTMLInputElement).value,
    ).toBe("64");
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(
      state.records.find((r) => r.id === `faith-${date}`)?.data,
    ).toMatchObject({
      prayer: true,
      scripture: true,
      church: true,
      duration: 30,
    });
    expect(
      state.records.find((r) => r.id === `nutrition-${date}`)?.data,
    ).toMatchObject({
      breakfast: true,
      dinner: true,
      snack: true,
      water: 64,
      protein: 90,
    });
    expect(
      state.records.find((r) => r.id === `skincare-${date}`)?.data,
    ).toMatchObject({ am: true, pm: true, irritation: 2 });
    expect(
      state.save.mock.calls.some(
        (call) => (call[0] as RecordInput).kind === "transaction",
      ),
    ).toBe(false);
  });

  it("preserves a partially completed faith routine when unrelated fields are saved", async () => {
    const date = today(),
      closed = vi.fn();
    state.records = [
      record(`faith-${date}`, "faith", {
        prayer: true,
        scripture: false,
        duration: 10,
      }),
    ];
    render(<QuickLog onClose={closed} />);
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(
      state.records.find((r) => r.id === `faith-${date}`)?.data,
    ).toMatchObject({ prayer: true, scripture: false, duration: 10 });
  });

  it("retains the displayed revision so a live update cannot be silently overwritten", async () => {
    const date = today(),
      closed = vi.fn();
    state.records = [
      record(`faith-${date}`, "faith", { prayer: false, scripture: false }, 1),
    ];
    state.save.mockImplementation(async (input: RecordInput) => {
      const remote = state.records.find((r) => r.id === input.id);
      if (input.revision !== undefined && input.revision !== remote?.revision)
        throw new Error(
          "This record changed while you were editing. Review the conflict.",
        );
      return persist(input);
    });
    const { rerender } = render(<QuickLog onClose={closed} />);
    state.records = [
      record(
        `faith-${date}`,
        "faith",
        { prayer: true, scripture: true, church: true },
        2,
      ),
    ];
    rerender(<QuickLog onClose={closed} />);
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await screen.findByText(
      "This record changed while you were editing. Review the conflict.",
    );
    expect(closed).not.toHaveBeenCalled();
    expect(state.records.find((r) => r.id === `faith-${date}`)).toMatchObject({
      revision: 2,
      data: { prayer: true, scripture: true, church: true },
    });
    expect(state.save.mock.calls[0][0]).toMatchObject({
      id: `faith-${date}`,
      revision: 1,
    });
  });

  it("retries a partial check-in without creating a second financial transaction", async () => {
    const date = today(),
      closed = vi.fn();
    let rejectDaily = true;
    state.save.mockImplementation(async (input: RecordInput) => {
      if (input.kind === "daily" && rejectDaily) {
        rejectDaily = false;
        throw new Error("Temporary daily-log failure; retry safely.");
      }
      return persist(input);
    });
    render(<QuickLog onClose={closed} />);
    fireEvent.change(screen.getByLabelText("New transaction amount ($)"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await screen.findByText("Temporary daily-log failure; retry safely.");
    expect(closed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    const transactionCalls = state.save.mock.calls
      .map((call) => call[0] as RecordInput)
      .filter((r) => r.kind === "transaction");
    expect(transactionCalls).toHaveLength(2);
    expect(new Set(transactionCalls.map((r) => r.id)).size).toBe(1);
    expect(state.records.filter((r) => r.kind === "transaction")).toHaveLength(
      1,
    );
    expect(financialTotals(state.records, date, date).spending).toBe(25);
  });
});
