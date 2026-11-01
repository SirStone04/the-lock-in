import { describe, expect, it } from "vitest";
import type { AppRecord, Data, Kind } from "../domain/models";
import {
  progression,
  previousExerciseSets,
  sessionSets,
  trainingVolume,
  validateExercises,
  WORKOUT_TEMPLATES,
} from "../domain/fitness";
import { assessmentAccuracy, examReadiness } from "../domain/education";

function record(
  id: string,
  kind: Kind,
  data: Data,
  date = "2026-11-03",
): AppRecord {
  return {
    id,
    kind,
    title: id,
    date,
    data,
    revision: 1,
    createdAt: `${date}T12:00:00Z`,
    updatedAt: `${date}T12:00:00Z`,
  };
}
const exercise = WORKOUT_TEMPLATES[0].exercises[0];
describe("workout records and progression", () => {
  it("resumes a session using independently saved sets and excludes incomplete volume", () => {
    const records = [
      record("a", "exerciseSet", {
        sessionId: "session",
        exercise: "Chest Press",
        index: 2,
        weight: 100,
        reps: 10,
        completed: true,
      }),
      record("b", "exerciseSet", {
        sessionId: "session",
        exercise: "Chest Press",
        index: 1,
        weight: 90,
        reps: 10,
        completed: false,
      }),
      record("c", "exerciseSet", {
        sessionId: "another",
        weight: 500,
        reps: 50,
        completed: true,
      }),
    ];
    expect(
      sessionSets(JSON.parse(JSON.stringify(records)), "session").map(
        (r) => r.id,
      ),
    ).toEqual(["b", "a"]);
    expect(trainingVolume(sessionSets(records, "session"))).toBe(1000);
  });
  it("uses the most recent completed earlier session and never current or future performance", () => {
    const session = record("today", "workout", { status: "in-progress" });
    const prior = record(
      "prior",
      "workout",
      { status: "completed" },
      "2026-10-27",
    );
    const future = record(
      "future",
      "workout",
      { status: "completed" },
      "2026-11-10",
    );
    const records = [
      session,
      prior,
      future,
      record("prior-set", "exerciseSet", {
        sessionId: "prior",
        exercise: "Chest Press",
        completed: true,
        weight: 50,
      }),
      record("future-set", "exerciseSet", {
        sessionId: "future",
        exercise: "Chest Press",
        completed: true,
        weight: 200,
      }),
      record("today-set", "exerciseSet", {
        sessionId: "today",
        exercise: "Chest Press",
        completed: true,
        weight: 100,
      }),
    ];
    expect(
      previousExerciseSets(records, session, "Chest Press").map((r) => r.id),
    ).toEqual(["prior-set"]);
  });
  it("recommends an increase only after every prescribed set reaches the top comfortably", () => {
    const sets = [1, 2, 3].map((index) =>
      record(`s${index}`, "exerciseSet", {
        index,
        completed: true,
        weight: 100,
        reps: 12,
        rpe: 8,
      }),
    );
    expect(progression(exercise, sets).action).toBe("increase");
    expect(progression(exercise, sets.slice(0, 2)).action).toBe("maintain");
    expect(progression(exercise, sets, 8, 8).action).toBe("reduce");
    expect(progression(exercise, sets, 2, 5.5).action).toBe("reduce");
    expect(progression(exercise, sets, 2, 8, 35).action).toBe("reduce");
    expect(progression(exercise, []).action).toBe("establish");
  });
  it("does not interpret missing RPE as easy effort", () => {
    const sets = [1, 2, 3].map((index) =>
      record(`s${index}`, "exerciseSet", {
        completed: true,
        reps: 12,
        weight: 100,
      }),
    );
    expect(progression(exercise, sets).action).toBe("maintain");
  });
  it("validates custom prescriptions without accepting impossible rep ranges", () => {
    expect(validateExercises(WORKOUT_TEMPLATES[0].exercises)).toHaveLength(5);
    expect(() =>
      validateExercises([{ ...exercise, minReps: 12, maxReps: 8 }]),
    ).toThrow();
    expect(() => validateExercises([{ ...exercise, sets: 0 }])).toThrow();
    expect(() => validateExercises([])).toThrow();
  });
});
describe("education readiness", () => {
  it("does not fabricate a baseline from absent or invalid scores", () => {
    expect(
      assessmentAccuracy(
        record("zero", "assessment", { questions: 0, correct: 0 }),
      ),
    ).toBeNull();
    expect(
      assessmentAccuracy(
        record("invalid", "assessment", { questions: 10, correct: 11 }),
      ),
    ).toBeNull();
    expect(examReadiness([])).toMatchObject({ ready: false, count: 0 });
  });
  it("requires the latest three fresh mixed assessments to meet 85%", () => {
    const records = [1, 2, 3].map((i) =>
      record(
        `test${i}`,
        "assessment",
        { questions: 100, correct: 85, fresh: true, mixed: true },
        `2026-11-0${i}`,
      ),
    );
    expect(examReadiness(records)).toMatchObject({ ready: true, count: 3 });
    records.push(
      record(
        "new-low",
        "assessment",
        { questions: 100, correct: 70, fresh: true, mixed: true },
        "2026-11-04",
      ),
    );
    expect(examReadiness(records)).toMatchObject({ ready: false, count: 2 });
  });
  it("does not count repeated or single-topic questions toward booking readiness", () => {
    const records = [
      record("repeat", "assessment", {
        questions: 100,
        correct: 100,
        fresh: false,
        mixed: true,
      }),
      record("topic", "assessment", {
        questions: 100,
        correct: 100,
        fresh: true,
        mixed: false,
      }),
    ];
    expect(examReadiness(records)).toMatchObject({ ready: false, count: 0 });
  });
});
