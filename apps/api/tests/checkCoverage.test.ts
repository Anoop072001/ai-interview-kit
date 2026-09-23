import { describe, it, expect } from "vitest";
import { checkCoverage } from "../src/pipeline/steps/checkCoverage.js";
import type { Requirement, Question } from "@aik/shared";

function req(id: string, priority: "must" | "nice" = "must"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirementIds: string[]): Question {
  return {
    id,
    requirement_ids: requirementIds,
    category: "technical",
    prompt: "?",
    answer_outline: "",
    difficulty: 1,
    state: "generated",
  };
}

describe("checkCoverage", () => {
  it("reports no gaps when every requirement is referenced by at least one question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];

    const result = checkCoverage(requirements, questions);

    expect(result.uncoveredRequirementIds).toEqual([]);
    expect(result.uncoveredMustIds).toEqual([]);
  });

  it("flags requirements no question references", () => {
    const requirements = [req("r1"), req("r2", "nice"), req("r3")];
    const questions = [q("q1", ["r1"])];

    const result = checkCoverage(requirements, questions);

    expect(result.uncoveredRequirementIds.sort()).toEqual(["r2", "r3"]);
    expect(result.uncoveredMustIds).toEqual(["r3"]);
  });

  it("counts a requirement covered by any question that references it, even alongside others", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1", "r2"])];

    const result = checkCoverage(requirements, questions);

    expect(result.uncoveredRequirementIds).toEqual([]);
  });

  it("treats an empty requirement list as fully covered", () => {
    const result = checkCoverage([], [q("q1", ["r1"])]);
    expect(result.uncoveredRequirementIds).toEqual([]);
  });
});
