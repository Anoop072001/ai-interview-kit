import { describe, it, expect } from "vitest";
import { buildSchedule } from "../src/pipeline/steps/buildSchedule.js";
import type { Requirement, Question } from "@aik/shared";

function req(id: string, priority: "must" | "nice" = "must"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirementIds: string[], difficulty: 1 | 2 | 3 = 2): Question {
  return {
    id,
    requirement_ids: requirementIds,
    category: "technical",
    prompt: "?",
    answer_outline: "",
    difficulty,
    state: "generated",
  };
}

describe("buildSchedule", () => {
  it("produces exactly as many days as requested", () => {
    const requirements = [req("r1"), req("r2"), req("r3")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];

    const schedule = buildSchedule(requirements, questions, 5);

    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
    expect(schedule.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every question_ids entry refers to a question that exists", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    const validIds = new Set(questions.map((q) => q.id));

    const schedule = buildSchedule(requirements, questions, 2);

    for (const day of schedule.days) {
      for (const id of day.question_ids) {
        expect(validIds.has(id)).toBe(true);
      }
    }
  });

  it("every must-have requirement's question appears somewhere in the schedule", () => {
    const requirements = [req("r1", "must"), req("r2", "nice"), req("r3", "must")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];

    const schedule = buildSchedule(requirements, questions, 3);
    const scheduledIds = new Set(schedule.days.flatMap((d) => d.question_ids));

    const mustQuestionIds = questions
      .filter((qq) => qq.requirement_ids.some((id) => requirements.find((r) => r.id === id)?.priority === "must"))
      .map((qq) => qq.id);

    for (const id of mustQuestionIds) {
      expect(scheduledIds.has(id)).toBe(true);
    }
  });

  it("front-loads must-priority and harder questions onto earlier days", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [
      q("q-easy-nice", ["r2"], 1),
      q("q-hard-must", ["r1"], 3),
    ];

    const schedule = buildSchedule(requirements, questions, 2);

    expect(schedule.days[0].question_ids).toContain("q-hard-must");
    expect(schedule.days[0].question_ids).not.toContain("q-easy-nice");
  });

  it("handles a 1-day schedule by packing everything into a single day", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];

    const schedule = buildSchedule(requirements, questions, 1);

    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids.sort()).toEqual(["q1", "q2"]);
  });

  it("handles far more days than content without leaving days out or fabricating questions", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"])];

    const schedule = buildSchedule(requirements, questions, 60);
    const validIds = new Set(questions.map((qq) => qq.id));

    expect(schedule.days).toHaveLength(60);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      for (const id of day.question_ids) expect(validIds.has(id)).toBe(true);
    }
  });

  it("produces well-formed empty days rather than throwing when there are no questions at all", () => {
    const schedule = buildSchedule([], [], 3);

    expect(schedule.days).toHaveLength(3);
    for (const day of schedule.days) {
      expect(day.question_ids).toEqual([]);
      expect(day.minutes).toBe(0);
    }
  });

  it("every day has an integer minutes value", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r1"], 3)];

    const schedule = buildSchedule(requirements, questions, 4);

    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });
});
