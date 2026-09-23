import { z } from "zod";

/**
 * Mirrors Appendix A of the assessment brief exactly. Field names and required
 * fields must not change — the batch harness and evaluators depend on this shape.
 * `state` on questions/flashcards is an allowed extension (brief: "you may extend
 * it where that genuinely helps") used to protect hand-edited/pinned items from
 * being clobbered when a section is regenerated.
 */

export const requirementKindSchema = z.enum(["technical", "behavioural", "domain"]);
export const requirementPrioritySchema = z.enum(["must", "nice"]);
export const questionCategorySchema = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
]);
export const itemStateSchema = z.enum(["generated", "edited", "pinned"]);

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: requirementKindSchema,
  priority: requirementPrioritySchema,
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  category: questionCategorySchema,
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  state: itemStateSchema.default("generated"),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  state: itemStateSchema.default("generated"),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string().min(1)),
  minutes: z.number().int().min(0),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().min(0),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: z.object({
    days_available: z.number().int().min(1),
    days: z.array(scheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().min(0),
  }),
});

export type RequirementKind = z.infer<typeof requirementKindSchema>;
export type RequirementPriority = z.infer<typeof requirementPrioritySchema>;
export type QuestionCategory = z.infer<typeof questionCategorySchema>;
export type ItemState = z.infer<typeof itemStateSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Flashcard = z.infer<typeof flashcardSchema>;
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;
export type Kit = z.infer<typeof kitSchema>;
