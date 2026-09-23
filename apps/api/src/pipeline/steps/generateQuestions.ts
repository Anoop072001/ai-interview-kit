import { z } from "zod";
import { generateStructured } from "../../llm/client.js";
import { questionCategorySchema, type Requirement, type QuestionCategory } from "@aik/shared";
import { wrapUntrusted, SAFETY_INSTRUCTION } from "../../utils/promptSafety.js";

const questionDraftSchema = z.object({
  requirement_ids: z.array(z.string()),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
});

const questionsOutputSchema = z.object({
  questions: z.array(questionDraftSchema),
});

export interface QuestionDraft {
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

// Deliberately distinct instructions per category (Section 3: "the two should
// not come from the same call with the same instructions") — a requirement
// like "5+ years with React" and one like "mentors junior engineers" need
// genuinely different kinds of questions, not the same template reused.
const CATEGORY_INSTRUCTIONS: Record<QuestionCategory, string> = {
  technical:
    "Write hands-on technical interview questions that test real, verifiable depth on the given requirement — implementation details, trade-offs, debugging scenarios, or \"how would you...\" design-in-the-small questions. Avoid trivia with a single memorized answer.",
  behavioural:
    "Write behavioural interview questions (STAR-style) that surface concrete past experience relevant to the given requirement — leadership, collaboration, conflict, mentorship, ambiguity. Each answer_outline should describe what a strong STAR answer covers, not a model answer.",
  "system-design":
    "Write system-design interview questions appropriate to the seniority and requirement given — open-ended architecture/scalability/trade-off problems. answer_outline should list the key dimensions a strong candidate would address (not a full design).",
  "company-fit":
    "Write questions that probe genuine fit with this company's specific domain/business context (not generic \"why do you want to work here\"), grounded in the given requirement.",
};

const SYSTEM_PROMPT_BASE = `You are an interview question writer generating one category of a question bank.
${SAFETY_INSTRUCTION}
Every question must reference which of the given requirement ids it covers, using only ids from the list provided — never invent a requirement id.
Prefer fewer, sharper questions over padding the list. difficulty is an integer 1-3 (1=entry-level, 3=senior/expert).`;

export interface QuestionGenContext {
  category: QuestionCategory;
  requirements: Requirement[];
  roleTitle: string;
  seniority: string;
  /** Extra grounding for this category only — e.g. hiring-process notes for system-design. */
  extraContext?: string;
}

export async function generateQuestionsForCategory(ctx: QuestionGenContext): Promise<QuestionDraft[]> {
  if (ctx.requirements.length === 0) return [];

  const reqList = ctx.requirements.map((r) => `- ${r.id} (${r.priority}): ${r.text}`).join("\n");
  const system = `${SYSTEM_PROMPT_BASE}\nCategory: ${ctx.category}. ${CATEGORY_INSTRUCTIONS[ctx.category]}`;

  const prompt = `Role: ${ctx.roleTitle || "the advertised role"} (${ctx.seniority || "seniority not specified"})

Requirements to cover:
${reqList}
${ctx.extraContext ? `\n${wrapUntrusted("hiring_process_notes", ctx.extraContext)}` : ""}

Generate one or more questions per requirement above (a requirement may be covered by more than one question if it's a "must" priority). Return JSON:
{ "questions": [{ "requirement_ids": string[], "prompt": string, "answer_outline": string, "difficulty": 1|2|3 }] }`;

  const result = await generateStructured(questionsOutputSchema, system, prompt);

  const validIds = new Set(ctx.requirements.map((r) => r.id));
  return result.questions
    .map((q) => ({
      ...q,
      category: ctx.category,
      requirement_ids: q.requirement_ids.filter((id) => validIds.has(id)),
    }))
    .filter((q) => q.requirement_ids.length > 0);
}

export { questionCategorySchema };
