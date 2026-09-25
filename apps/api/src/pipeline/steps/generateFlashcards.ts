import { z } from "zod";
import { generateStructured } from "../../llm/client.js";
import type { Requirement } from "@aik/shared";
import { SAFETY_INSTRUCTION } from "../../utils/promptSafety.js";

const flashcardDraftSchema = z.object({
  requirement_ids: z.array(z.string()),
  front: z.string().min(1),
  back: z.string().min(1),
});

const flashcardsOutputSchema = z.object({
  flashcards: z.array(flashcardDraftSchema),
});

export interface FlashcardDraft {
  requirement_ids: string[];
  front: string;
  back: string;
}

const SYSTEM_PROMPT = `You are writing spaced-repetition flashcards to help someone study the SUBJECT MATTER behind a job's requirements — not quiz them on the job posting itself.
${SAFETY_INSTRUCTION}
Each requirement names a skill or technology (e.g. "5+ years with React", "experience with PostgreSQL"). For each one, write a card that tests real, concrete knowledge of that subject: a concept, a mechanism, a trade-off, a common pitfall, or "what does X do and when would you reach for it" — the kind of thing you'd actually need to know to answer an interview question about it well.

Never write a card whose front asks what the job requires, or whose back just restates the requirement text. That tests nothing.
Bad: front "Which database should candidates know?", back "PostgreSQL".
Good: front "In PostgreSQL, what's the difference between a B-tree and a GIN index, and when would you use each?", back "<concrete answer>".

"front" is a short, specific question about the subject matter. "back" is a concise, concrete answer (a few sentences at most, not an essay).
Reference only the requirement ids given — never invent one.`;

export async function generateFlashcards(
  requirements: Requirement[],
  roleTitle: string
): Promise<FlashcardDraft[]> {
  if (requirements.length === 0) return [];

  const reqList = requirements.map((r) => `- ${r.id} (${r.priority}, ${r.kind}): ${r.text}`).join("\n");
  const prompt = `Role: ${roleTitle || "the advertised role"}

Requirements to make flashcards for (prioritize "must" requirements; you don't need a card for every "nice" one):
${reqList}

Return JSON: { "flashcards": [{ "requirement_ids": string[], "front": string, "back": string }] }`;

  const result = await generateStructured(flashcardsOutputSchema, SYSTEM_PROMPT, prompt);

  const validIds = new Set(requirements.map((r) => r.id));
  return result.flashcards
    .map((f) => ({ ...f, requirement_ids: f.requirement_ids.filter((id) => validIds.has(id)) }))
    .filter((f) => f.requirement_ids.length > 0);
}
