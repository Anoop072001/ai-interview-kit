import type { Requirement, Question, ScheduleDay, QuestionCategory } from "@aik/shared";

const MINUTES_BY_DIFFICULTY: Record<number, number> = { 1: 10, 2: 15, 3: 20 };
const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System design",
  "company-fit": "Company fit",
};

function questionMinutes(q: Question): number {
  return MINUTES_BY_DIFFICULTY[q.difficulty] ?? 15;
}

function isMustQuestion(q: Question, mustIds: Set<string>): boolean {
  return q.requirement_ids.some((id) => mustIds.has(id));
}

function dominantCategory(questions: Question[]): QuestionCategory | null {
  if (questions.length === 0) return null;
  const counts = new Map<QuestionCategory, number>();
  for (const q of questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Deterministic — Section 3/8 explicitly call this arithmetic/allocation,
 * not something to hand to the model. Sorts must-priority and harder
 * questions to the front, then chunks them into contiguous, front-loaded
 * blocks across exactly `daysAvailable` days. If there are more days than
 * there is content (Section 10's 60-day case), trailing days become lighter
 * spaced-review passes over the must-have material rather than being left
 * empty or fabricated.
 */
export function buildSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number
): { days_available: number; days: ScheduleDay[] } {
  const mustIds = new Set(requirements.filter((r) => r.priority === "must").map((r) => r.id));

  const sorted = [...questions].sort((a, b) => {
    const aMust = isMustQuestion(a, mustIds);
    const bMust = isMustQuestion(b, mustIds);
    if (aMust !== bMust) return aMust ? -1 : 1;
    if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
    return 0;
  });

  const days: ScheduleDay[] = [];

  if (sorted.length === 0) {
    for (let d = 1; d <= daysAvailable; d++) {
      days.push({ day: d, focus: "No questions available yet", question_ids: [], minutes: 0 });
    }
    return { days_available: daysAvailable, days };
  }

  const contentDays = Math.min(daysAvailable, sorted.length);
  const baseSize = Math.floor(sorted.length / contentDays);
  const remainder = sorted.length % contentDays;

  let cursor = 0;
  for (let d = 1; d <= contentDays; d++) {
    // Earlier days absorb the remainder, so they're never smaller than later
    // ones — keeps harder/must-heavy material front-loaded rather than
    // trailing off unevenly.
    const size = baseSize + (d <= remainder ? 1 : 0);
    const chunk = sorted.slice(cursor, cursor + size);
    cursor += size;

    const category = dominantCategory(chunk);
    const mustCount = chunk.filter((q) => isMustQuestion(q, mustIds)).length;
    const focus = category
      ? `${CATEGORY_LABEL[category]} focus${mustCount > 0 ? ` (${mustCount} must-have)` : ""}`
      : "Mixed review";

    days.push({
      day: d,
      focus,
      question_ids: chunk.map((q) => q.id),
      minutes: chunk.reduce((sum, q) => sum + questionMinutes(q), 0),
    });
  }

  // Buffer/review days beyond the content — spaced repetition over the
  // must-have questions rather than an empty day.
  const mustQuestions = sorted.filter((q) => isMustQuestion(q, mustIds));
  for (let d = contentDays + 1; d <= daysAvailable; d++) {
    const reviewSet = mustQuestions.slice(0, 6);
    days.push({
      day: d,
      focus: reviewSet.length > 0 ? "Spaced review of must-have topics" : "Free review / mock practice",
      question_ids: reviewSet.map((q) => q.id),
      minutes: Math.round(reviewSet.reduce((sum, q) => sum + questionMinutes(q), 0) / 2),
    });
  }

  return { days_available: daysAvailable, days };
}
