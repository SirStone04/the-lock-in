// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AppRecord } from "../domain/models";
import { Faith } from "../pages/trackers/Faith";
import { Nutrition } from "../pages/trackers/Nutrition";
import { Skincare } from "../pages/trackers/Skincare";
import { Sleep } from "../pages/trackers/Sleep";
import Fitness from "../pages/Fitness";

const state = vi.hoisted(() => ({
  records: [] as AppRecord[],
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../data/store", () => ({ useApp: () => state }));
beforeEach(() => {
  state.records = [];
});
afterEach(cleanup);

describe("private profile presentation", () => {
  it("leaves personal baselines unset when the account has no private profile", () => {
    const faith = render(<Faith />);
    expect(screen.getByText("No passage selected")).toBeTruthy();
    faith.unmount();
    const nutrition = render(<Nutrition />);
    expect(screen.getByText("No breakfast routine set.")).toBeTruthy();
    nutrition.unmount();
    const skin = render(<Skincare />);
    expect(screen.getAllByText(/No baseline →/)).toHaveLength(4);
    skin.unmount();
    const sleep = render(<Sleep />);
    expect(screen.getByText("No sleep window set")).toBeTruthy();
    sleep.unmount();
    render(<Fitness />);
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("renders user-selected account data instead of public source defaults", () => {
    state.records = [
      {
        id: "settings-profile",
        kind: "settings",
        date: "2027-04-10",
        title: "Synthetic private profile",
        revision: 1,
        createdAt: "2027-04-10T12:00:00Z",
        updatedAt: "2027-04-10T12:00:00Z",
        data: {
          faithPassage: "Selected passage",
          faithDurations: [12, 12, 12, 12, 12, 12, 12],
          nutritionRoutine: { breakfast: "Selected meal" },
          skinBaseline: {
            breakouts: 0,
            texture: 0,
            darkMarks: 3,
            irritation: 3,
          },
          skinBaselineDate: "2027-04-09",
          skinStartDate: "2027-04-10",
          skinReviewDates: ["2027-04-17"],
          bedtime: "22:00",
          wakeTime: "06:00",
          homeArrival: "19:45",
          gymName: "Selected gym",
          trainingDays: [1, 5],
        },
      },
    ];
    const faith = render(<Faith />);
    expect(screen.getByText("Selected passage")).toBeTruthy();
    faith.unmount();
    const nutrition = render(<Nutrition />);
    expect(screen.getByText("Selected meal")).toBeTruthy();
    nutrition.unmount();
    const skin = render(<Skincare />);
    expect(screen.getByText("2027-04-10")).toBeTruthy();
    expect(screen.getByText(/Your review dates: 2027-04-17/)).toBeTruthy();
    skin.unmount();
    const sleep = render(<Sleep />);
    expect(screen.getByText("22:00 → 06:00")).toBeTruthy();
    sleep.unmount();
    render(<Fitness />);
    expect(screen.getByText("Mon / Fri")).toBeTruthy();
    expect(screen.getByText(/Train with purpose.*Selected gym/)).toBeTruthy();
  });
});
