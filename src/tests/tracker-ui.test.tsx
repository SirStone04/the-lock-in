// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AppRecord, RecordInput } from "../domain/models";
import { today } from "../domain/dates";
import { Employment } from "../pages/trackers/Employment";
import { Finances } from "../pages/trackers/Finances";
import { QuickRoutine } from "../pages/trackers/QuickRoutine";

const state = vi.hoisted(() => ({
  records: [] as AppRecord[],
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../data/store", () => ({ useApp: () => state }));

const account = (id = "checking"): AppRecord => ({
  id,
  kind: "account",
  date: today(),
  title: "Checking",
  data: {
    reconciled: true,
    reconciledBalance: 400,
    reconciledThrough: today(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  revision: 1,
});

beforeEach(() => {
  state.records = [];
  state.save.mockReset();
  state.remove.mockReset();
  state.save.mockImplementation(
    async (input: RecordInput) => input.id ?? "new-record",
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("actual life-area entry workflows", () => {
  it("logs a routine meal with a stable date ID and no invented nutrition amounts", async () => {
    render(
      <QuickRoutine
        kind="nutrition"
        title="Daily fueling"
        items={[{ key: "breakfast", label: "Breakfast" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Breakfast" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    const input = state.save.mock.calls[0][0] as RecordInput;
    expect(input.id).toBe(`nutrition-${today()}`);
    expect(input.data).toEqual({ breakfast: true });
    expect(input.data.protein).toBeUndefined();
    expect(input.data.calories).toBeUndefined();
  });

  it("corrects an existing routine entry rather than duplicating it", async () => {
    state.records = [
      {
        ...account(`nutrition-${today()}`),
        kind: "nutrition",
        data: { breakfast: true, water: 40 },
        revision: 3,
      },
    ];
    render(
      <QuickRoutine
        kind="nutrition"
        title="Daily fueling"
        items={[{ key: "breakfast", label: "Breakfast" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Breakfast" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0]).toMatchObject({
      id: `nutrition-${today()}`,
      revision: 3,
      data: { breakfast: false, water: 40 },
    });
  });

  it("creates exactly one stable linked income transaction for an actual paycheck", async () => {
    state.records = [account()];
    render(<Employment />);
    fireEvent.click(screen.getByRole("button", { name: /Add paycheck/ }));
    fireEvent.change(screen.getByLabelText("Gross pay · $"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Deductions · $"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Actual net deposit · $"), {
      target: { value: "800" },
    });
    fireEvent.change(screen.getByLabelText("Deposited to"), {
      target: { value: "checking" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save paycheck + deposit" }),
    );
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));
    const payroll = state.save.mock.calls[0][0] as RecordInput;
    const deposit = state.save.mock.calls[1][0] as RecordInput;
    expect(payroll.kind).toBe("payroll");
    expect(payroll.data.net).toBe(800);
    expect(deposit).toMatchObject({
      id: `paycheck-income-${payroll.id}`,
      kind: "transaction",
      data: {
        type: "income",
        category: "Paycheck",
        amount: 800,
        payrollId: payroll.id,
        toAccount: "checking",
      },
    });
  });

  it("rejects inconsistent payroll totals before any records are saved", async () => {
    render(<Employment />);
    fireEvent.click(screen.getByRole("button", { name: /Add paycheck/ }));
    fireEvent.change(screen.getByLabelText("Gross pay · $"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Deductions · $"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Actual net deposit · $"), {
      target: { value: "1000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save paycheck + deposit" }),
    );
    await screen.findByText(
      "Gross minus deductions must equal actual net pay.",
    );
    expect(state.save).not.toHaveBeenCalled();
  });

  it("edits a paycheck and the existing deposit under the same IDs", async () => {
    state.records = [
      account(),
      {
        ...account("payroll-1"),
        kind: "payroll",
        title: "Warehouse paycheck",
        data: {
          gross: 1000,
          deductions: 200,
          net: 800,
          accountId: "checking",
          reference: "week-1",
        },
        revision: 2,
      },
      {
        ...account("paycheck-income-payroll-1"),
        kind: "transaction",
        data: { type: "income", amount: 800, payrollId: "payroll-1" },
        revision: 3,
      },
    ];
    render(<Employment />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Gross pay · $"), {
      target: { value: "1100" },
    });
    fireEvent.change(screen.getByLabelText("Actual net deposit · $"), {
      target: { value: "900" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save paycheck + deposit" }),
    );
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));
    expect(state.save.mock.calls[0][0]).toMatchObject({
      id: "payroll-1",
      revision: 2,
      data: { net: 900 },
    });
    expect(state.save.mock.calls[1][0]).toMatchObject({
      id: "paycheck-income-payroll-1",
      revision: 3,
      data: { amount: 900, payrollId: "payroll-1" },
    });
  });

  it("confirms and removes both paycheck and linked deposit", async () => {
    state.records = [
      {
        ...account("payroll-1"),
        kind: "payroll",
        title: "Warehouse paycheck",
        data: { gross: 1000, deductions: 200, net: 800 },
      },
    ];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Employment />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(state.remove).toHaveBeenCalledTimes(2));
    expect(window.confirm).toHaveBeenCalledWith(
      "Delete this paycheck and its linked income transaction?",
    );
    expect(state.remove.mock.calls.map((call) => call[0])).toEqual([
      "paycheck-income-payroll-1",
      "payroll-1",
    ]);
  });

  it("requires different owned accounts for an internal transfer", async () => {
    state.records = [account()];
    render(<Finances />);
    fireEvent.click(screen.getByRole("button", { name: /Log transaction/ }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Savings transfer" },
    });
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "transfer" },
    });
    fireEvent.change(screen.getByLabelText("Actual amount · $"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("From account"), {
      target: { value: "checking" },
    });
    fireEvent.change(screen.getByLabelText("To account"), {
      target: { value: "checking" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    await screen.findByText(
      "Choose two different accounts for an internal transfer.",
    );
    expect(state.save).not.toHaveBeenCalled();
  });

  it("preserves debt principal and interest without creating an extra outflow", async () => {
    state.records = [account()];
    render(<Finances />);
    fireEvent.click(screen.getByRole("button", { name: /Log transaction/ }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Car debt payment" },
    });
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "debt" },
    });
    fireEvent.change(screen.getByLabelText("Actual amount · $"), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText("Principal · $"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Interest · $"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("From account"), {
      target: { value: "checking" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0]).toMatchObject({
      kind: "transaction",
      data: {
        type: "debt",
        amount: 120,
        principal: 100,
        interest: 20,
        fromAccount: "checking",
      },
    });
  });
});
