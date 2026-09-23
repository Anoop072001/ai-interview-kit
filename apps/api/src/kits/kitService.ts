import { kitSchema, type Kit, type Question, type Flashcard, type QuestionCategory } from "@aik/shared";
import { nextIdAfter } from "../utils/ids.js";

export class KitEditError extends Error {
  code = "KIT_EDIT_ERROR";
}

function markEdited<T extends { state: "generated" | "edited" | "pinned" }>(item: T): T {
  return item.state === "pinned" ? item : { ...item, state: "edited" };
}

export function addQuestion(kit: Kit, input: Omit<Question, "id" | "state">): Kit {
  const nextId = nextIdAfter(kit.questions.map((q) => q.id), "q");
  const question: Question = { ...input, id: nextId(), state: "pinned" };
  return kitSchema.parse({ ...kit, questions: [...kit.questions, question] });
}

export function editQuestion(kit: Kit, questionId: string, patch: Partial<Omit<Question, "id" | "state">>): Kit {
  const index = kit.questions.findIndex((q) => q.id === questionId);
  if (index === -1) throw new KitEditError(`No such question: ${questionId}`);

  const questions = [...kit.questions];
  questions[index] = markEdited({ ...questions[index], ...patch });
  return kitSchema.parse({ ...kit, questions });
}

export function deleteQuestion(kit: Kit, questionId: string): Kit {
  return kitSchema.parse({ ...kit, questions: kit.questions.filter((q) => q.id !== questionId) });
}

/** Reorders questions within a single category, leaving other categories'
 * relative positions untouched. `orderedIds` must be exactly the current set
 * of ids in that category, in the desired new order. */
export function reorderQuestions(kit: Kit, category: QuestionCategory, orderedIds: string[]): Kit {
  const currentInCategory = kit.questions.filter((q) => q.category === category).map((q) => q.id);
  const sameSet =
    currentInCategory.length === orderedIds.length && currentInCategory.every((id) => orderedIds.includes(id));
  if (!sameSet) {
    throw new KitEditError("orderedIds must match the current question ids in this category exactly");
  }

  const byId = new Map(kit.questions.map((q) => [q.id, q]));
  const queue = [...orderedIds];
  const questions = kit.questions.map((q) => (q.category === category ? byId.get(queue.shift()!)! : q));

  return kitSchema.parse({ ...kit, questions });
}

export function addFlashcard(kit: Kit, input: Omit<Flashcard, "id" | "state">): Kit {
  const nextId = nextIdAfter(kit.flashcards.map((f) => f.id), "f");
  const flashcard: Flashcard = { ...input, id: nextId(), state: "pinned" };
  return kitSchema.parse({ ...kit, flashcards: [...kit.flashcards, flashcard] });
}

export function editFlashcard(kit: Kit, flashcardId: string, patch: Partial<Omit<Flashcard, "id" | "state">>): Kit {
  const index = kit.flashcards.findIndex((f) => f.id === flashcardId);
  if (index === -1) throw new KitEditError(`No such flashcard: ${flashcardId}`);

  const flashcards = [...kit.flashcards];
  flashcards[index] = markEdited({ ...flashcards[index], ...patch });
  return kitSchema.parse({ ...kit, flashcards });
}

export function deleteFlashcard(kit: Kit, flashcardId: string): Kit {
  return kitSchema.parse({ ...kit, flashcards: kit.flashcards.filter((f) => f.id !== flashcardId) });
}

export function editCompanyBrief(kit: Kit, patch: Partial<Kit["company_brief"]>): Kit {
  return kitSchema.parse({ ...kit, company_brief: { ...kit.company_brief, ...patch } });
}
