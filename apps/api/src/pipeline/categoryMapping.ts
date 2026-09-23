import type { Requirement, RequirementKind, QuestionCategory } from "@aik/shared";

/** A requirement's natural question category, per its kind. Domain knowledge
 * requirements map to "company-fit" — they're about fit with this specific
 * business context, not generic technical or behavioural skill. */
const KIND_TO_CATEGORY: Record<RequirementKind, QuestionCategory> = {
  technical: "technical",
  behavioural: "behavioural",
  domain: "company-fit",
};

export function groupByCategory(requirements: Requirement[]): Map<QuestionCategory, Requirement[]> {
  const map = new Map<QuestionCategory, Requirement[]>();
  for (const r of requirements) {
    const category = KIND_TO_CATEGORY[r.kind];
    const existing = map.get(category) ?? [];
    existing.push(r);
    map.set(category, existing);
  }
  return map;
}
