import type { Requirement, Question } from "@aik/shared";

export interface CoverageResult {
  uncoveredRequirementIds: string[];
  uncoveredMustIds: string[];
}

/**
 * Deterministic — Section 3 explicitly says this comparison is the
 * application's decision, not the model's. Pure set difference: every
 * requirement id vs the union of ids referenced by all questions.
 */
export function checkCoverage(requirements: Requirement[], questions: Question[]): CoverageResult {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const id of q.requirement_ids) covered.add(id);
  }

  const uncovered = requirements.filter((r) => !covered.has(r.id));

  return {
    uncoveredRequirementIds: uncovered.map((r) => r.id),
    uncoveredMustIds: uncovered.filter((r) => r.priority === "must").map((r) => r.id),
  };
}
