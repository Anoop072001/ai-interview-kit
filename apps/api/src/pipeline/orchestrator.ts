import { kitSchema, type Kit, type Question, type Flashcard } from "@aik/shared";
import { config } from "../config/env.js";
import { extractRequirements } from "./steps/extractRequirements.js";
import { crawlCompanySite, CompanySiteUnreachableError, type CrawlResult } from "../retrieval/siteCrawler.js";
import { findPublicDiscussion } from "../retrieval/publicDiscovery.js";
import { analyzeHiringProcess } from "./steps/analyzeHiringProcess.js";
import { generateBrief } from "./steps/generateBrief.js";
import { generateQuestionsForCategory, type QuestionDraft } from "./steps/generateQuestions.js";
import { generateFlashcards } from "./steps/generateFlashcards.js";
import { checkCoverage } from "./steps/checkCoverage.js";
import { buildSchedule } from "./steps/buildSchedule.js";
import { groupByCategory } from "./categoryMapping.js";
import { makeIdSequence } from "../utils/ids.js";

export class PipelineFailedError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

export type StepStatus = "running" | "done" | "failed" | "skipped";
export type ProgressReporter = (step: string, status: StepStatus, message?: string) => void;

export interface PipelineInput {
  jd: string;
  companyUrl: string;
  days: number;
}

export interface PipelineOptions {
  /** true only for the batch CLI and local dev — Section 9's test sites are
   * served from localhost, but the live app must reject that from real users. */
  allowLocal: boolean;
  onProgress?: ProgressReporter;
}

function deriveCompanyName(companyUrl: string, pages: CrawlResult["pages"]): string {
  const homeTitle = pages[0]?.title?.trim();
  if (homeTitle) return homeTitle.split(/[|\-–]/)[0].trim();
  try {
    return new URL(companyUrl).hostname.replace(/^www\./, "");
  } catch {
    return companyUrl;
  }
}

export async function runPipeline(input: PipelineInput, options: PipelineOptions): Promise<Kit> {
  const report: ProgressReporter = options.onProgress ?? (() => {});
  const { jd, companyUrl, days } = input;

  // 1. Extract requirements from the pasted JD — no retrieval needed for this
  // step, it's pure text (Section 3: "pasted text needs no retrieval at all").
  report("extract_requirements", "running");
  let extracted;
  try {
    extracted = await extractRequirements(jd);
  } catch (err) {
    report("extract_requirements", "failed", String(err));
    throw new PipelineFailedError(
      `Could not extract requirements from the job description: ${err instanceof Error ? err.message : err}`,
      "EXTRACTION_FAILED"
    );
  }
  report("extract_requirements", "done", `${extracted.requirements.length} requirements found`);

  // 2. Crawl the company site. An unreachable/broken site does not fail the
  // whole run (Section 10) — we continue with an honest, sparse kit.
  report("crawl_company_site", "running");
  let crawl: CrawlResult = { pages: [], hiringPageUrl: null, skipped: [] };
  try {
    crawl = await crawlCompanySite(companyUrl, { allowLocal: options.allowLocal, maxPages: config.MAX_CRAWL_PAGES });
    report(
      "crawl_company_site",
      "done",
      `${crawl.pages.length} pages fetched, hiring page ${crawl.hiringPageUrl ? "found" : "not found"}, ${crawl.skipped.length} source(s) skipped`
    );
  } catch (err) {
    if (err instanceof CompanySiteUnreachableError) {
      report("crawl_company_site", "failed", `Company site unreachable: ${err.message}`);
    } else {
      report("crawl_company_site", "failed", String(err));
    }
  }

  const companyName = deriveCompanyName(companyUrl, crawl.pages);

  // 3. Public discussion of the interview process.
  report("search_public_discussion", "running");
  const discussion = await findPublicDiscussion(companyName);
  report(
    "search_public_discussion",
    discussion.searched ? "done" : "skipped",
    discussion.note ?? `${discussion.snippets.length} result(s)`
  );

  const hiringSignal = analyzeHiringProcess(crawl.pages, discussion.snippets);

  // 4. Company brief.
  report("generate_brief", "running");
  let brief;
  try {
    brief = await generateBrief(companyUrl, crawl.pages, discussion.snippets);
    report("generate_brief", "done");
  } catch (err) {
    report("generate_brief", "failed", String(err));
    brief = {
      summary: "Could not generate a company summary due to a generation error.",
      what_they_do: "",
      sources: [...crawl.pages.map((p) => p.url), ...discussion.snippets.map((d) => d.url)],
    };
  }

  // 5. Questions, generated per (requirement-cluster, category) — never one
  // mega-prompt for everything (Section 3).
  report("generate_questions", "running");
  const nextQuestionId = makeIdSequence("q");
  const questions: Question[] = [];

  const grouped = groupByCategory(extracted.requirements);
  for (const [category, reqs] of grouped) {
    try {
      const drafts = await generateQuestionsForCategory({
        category,
        requirements: reqs,
        roleTitle: extracted.title,
        seniority: extracted.seniority,
      });
      questions.push(...toQuestions(drafts, nextQuestionId));
    } catch (err) {
      report("generate_questions", "failed", `${category}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // A hiring-process page that mentions a system-design round changes what
  // questions make sense (Section 3) — generate that category only when we
  // actually found evidence for it, grounded in the must-have technical work.
  if (hiringSignal.mentionsSystemDesign) {
    const sysDesignReqs = extracted.requirements
      .filter((r) => r.kind === "technical" && r.priority === "must")
      .slice(0, 3);
    if (sysDesignReqs.length > 0) {
      try {
        const drafts = await generateQuestionsForCategory({
          category: "system-design",
          requirements: sysDesignReqs,
          roleTitle: extracted.title,
          seniority: extracted.seniority,
          extraContext: hiringSignal.notes,
        });
        questions.push(...toQuestions(drafts, nextQuestionId));
      } catch (err) {
        report("generate_questions", "failed", `system-design: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  report("generate_questions", "done", `${questions.length} questions generated`);

  // 6. Coverage check + gap-fill loop (Section 4). Deterministic check,
  // targeted regeneration only for what's missing, capped passes.
  report("check_coverage", "running");
  let passes = 1;
  let coverage = checkCoverage(extracted.requirements, questions);

  while (coverage.uncoveredRequirementIds.length > 0 && passes < config.MAX_COVERAGE_PASSES) {
    const uncoveredReqs = extracted.requirements
      .filter((r) => coverage.uncoveredRequirementIds.includes(r.id))
      .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "must" ? -1 : 1));

    const gapGroups = groupByCategory(uncoveredReqs);
    for (const [category, reqs] of gapGroups) {
      try {
        const drafts = await generateQuestionsForCategory({
          category,
          requirements: reqs,
          roleTitle: extracted.title,
          seniority: extracted.seniority,
        });
        questions.push(...toQuestions(drafts, nextQuestionId));
      } catch (err) {
        report("check_coverage", "failed", `gap-fill ${category}: ${err instanceof Error ? err.message : err}`);
      }
    }

    passes += 1;
    coverage = checkCoverage(extracted.requirements, questions);
  }
  report(
    "check_coverage",
    "done",
    `${coverage.uncoveredRequirementIds.length} requirement(s) still uncovered after ${passes} pass(es)`
  );

  // 7. Flashcards, derived from the finalized requirements.
  report("generate_flashcards", "running");
  const flashcards: Flashcard[] = [];
  try {
    const nextFlashcardId = makeIdSequence("f");
    const drafts = await generateFlashcards(extracted.requirements, extracted.title);
    for (const d of drafts) {
      flashcards.push({ id: nextFlashcardId(), front: d.front, back: d.back, requirement_ids: d.requirement_ids, state: "generated" });
    }
    report("generate_flashcards", "done", `${flashcards.length} flashcards`);
  } catch (err) {
    report("generate_flashcards", "failed", String(err));
  }

  // 8. Schedule — deterministic allocation across exactly `days` days.
  report("build_schedule", "running");
  const schedule = buildSchedule(extracted.requirements, questions, days);
  report("build_schedule", "done");

  const kit: Kit = {
    source: {
      company: companyName,
      company_url: companyUrl,
      role: extracted.title,
      location: extracted.location,
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pages.map((p) => p.url),
    },
    company_brief: brief,
    role: {
      title: extracted.title,
      seniority: extracted.seniority,
      responsibilities: extracted.responsibilities,
      requirements: extracted.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: coverage.uncoveredRequirementIds, passes },
  };

  const validated = kitSchema.safeParse(kit);
  if (!validated.success) {
    throw new PipelineFailedError(
      `Generated kit failed structural validation: ${validated.error.issues.map((i) => i.message).join("; ")}`,
      "INVALID_KIT_STRUCTURE"
    );
  }

  return validated.data;
}

function toQuestions(drafts: QuestionDraft[], nextId: () => string): Question[] {
  return drafts.map((d) => ({
    id: nextId(),
    requirement_ids: d.requirement_ids,
    category: d.category,
    prompt: d.prompt,
    answer_outline: d.answer_outline,
    difficulty: d.difficulty,
    state: "generated",
  }));
}
