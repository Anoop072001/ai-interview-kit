import { kitSchema, type Kit, type Question, type QuestionCategory, type Flashcard } from "@aik/shared";
import { config } from "../config/env.js";
import { crawlCompanySite, CompanySiteUnreachableError, type CrawlResult } from "../retrieval/siteCrawler.js";
import { findPublicDiscussion } from "../retrieval/publicDiscovery.js";
import { generateBrief } from "./steps/generateBrief.js";
import { generateQuestionsForCategory } from "./steps/generateQuestions.js";
import { generateFlashcards } from "./steps/generateFlashcards.js";
import { checkCoverage } from "./steps/checkCoverage.js";
import { buildSchedule } from "./steps/buildSchedule.js";
import { groupByCategory } from "./categoryMapping.js";
import { nextIdAfter } from "../utils/ids.js";

export type RegeneratableSection = "company_brief" | QuestionCategory | "flashcards" | "schedule";

export interface RegenerateOptions {
  allowLocal: boolean;
}

/**
 * The "hardest state problem" (Section 6): regenerating one section must not
 * discard edits made elsewhere, and a question/flashcard the user wrote or
 * edited by hand must survive a regeneration of its own category. Every item
 * carries a `state` of "generated" | "edited" | "pinned" (@aik/shared) — this
 * module only ever replaces items still in "generated" state and always
 * keeps "edited"/"pinned" ones, in whichever section is targeted.
 */
export async function regenerateSection(
  kit: Kit,
  section: RegeneratableSection,
  options: RegenerateOptions
): Promise<Kit> {
  if (section === "company_brief") return regenerateBrief(kit, options);
  if (section === "flashcards") return regenerateFlashcards(kit);
  if (section === "schedule") return regenerateSchedule(kit);
  return regenerateQuestionCategory(kit, section);
}

async function regenerateBrief(kit: Kit, options: RegenerateOptions): Promise<Kit> {
  let crawl: CrawlResult = { pages: [], hiringPageUrl: null, skipped: [] };
  try {
    crawl = await crawlCompanySite(kit.source.company_url, {
      allowLocal: options.allowLocal,
      maxPages: config.MAX_CRAWL_PAGES,
    });
  } catch (err) {
    if (!(err instanceof CompanySiteUnreachableError)) throw err;
  }
  const discussion = await findPublicDiscussion(kit.source.company);
  const brief = await generateBrief(kit.source.company_url, crawl.pages, discussion.snippets);

  return kitSchema.parse({
    ...kit,
    company_brief: brief,
    source: { ...kit.source, pages_used: crawl.pages.map((p) => p.url) || kit.source.pages_used },
  });
}

async function regenerateQuestionCategory(kit: Kit, category: QuestionCategory): Promise<Kit> {
  const kept = kit.questions.filter((q) => q.category !== category || q.state !== "generated");
  const protectedRequirementIds = new Set(
    kit.questions
      .filter((q) => q.category === category && q.state !== "generated")
      .flatMap((q) => q.requirement_ids)
  );

  // Same category->requirement mapping used at initial generation time, so a
  // regeneration targets the same requirements the category was built from —
  // minus any requirement already covered by a question the user pinned or
  // hand-edited in this category, so regenerating doesn't pile on duplicates.
  const grouped = groupByCategory(kit.role.requirements);
  const targetRequirements = (grouped.get(category) ?? []).filter((r) => !protectedRequirementIds.has(r.id));

  const drafts = targetRequirements.length
    ? await generateQuestionsForCategory({
        category,
        requirements: targetRequirements,
        roleTitle: kit.role.title,
        seniority: kit.role.seniority,
      })
    : [];

  const nextId = nextIdAfter(kit.questions.map((q) => q.id), "q");
  const fresh: Question[] = drafts.map((d) => ({
    id: nextId(),
    requirement_ids: d.requirement_ids,
    category: d.category,
    prompt: d.prompt,
    answer_outline: d.answer_outline,
    difficulty: d.difficulty,
    state: "generated",
  }));

  const questions = [...kept, ...fresh];
  const coverage = checkCoverage(kit.role.requirements, questions);

  return kitSchema.parse({
    ...kit,
    questions,
    coverage: { uncovered_requirement_ids: coverage.uncoveredRequirementIds, passes: kit.coverage.passes },
  });
}

async function regenerateFlashcards(kit: Kit): Promise<Kit> {
  const kept = kit.flashcards.filter((f) => f.state !== "generated");
  const coveredByKept = new Set(kept.flatMap((f) => f.requirement_ids));
  const targetRequirements = kit.role.requirements.filter((r) => !coveredByKept.has(r.id));

  const drafts = await generateFlashcards(targetRequirements, kit.role.title);
  const nextId = nextIdAfter(kit.flashcards.map((f) => f.id), "f");
  const fresh: Flashcard[] = drafts.map((d) => ({
    id: nextId(),
    front: d.front,
    back: d.back,
    requirement_ids: d.requirement_ids,
    state: "generated",
  }));

  return kitSchema.parse({ ...kit, flashcards: [...kept, ...fresh] });
}

async function regenerateSchedule(kit: Kit): Promise<Kit> {
  const schedule = buildSchedule(kit.role.requirements, kit.questions, kit.schedule.days_available);
  return kitSchema.parse({ ...kit, schedule });
}
