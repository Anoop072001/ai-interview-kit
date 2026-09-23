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

const SYSTEM_PROMPT = `You are writing spaced-repetition style flashcards for someone preparing for an interview.
${SAFETY_INSTRUCTION}
Each card's "front" is a short prompt/question, "back" is a concise, concrete answer (a few sentences at most, not an essay).
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
