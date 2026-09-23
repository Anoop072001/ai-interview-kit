import type { CrawledPage } from "../../retrieval/siteCrawler.js";
import type { DiscussionSnippet } from "../../retrieval/publicDiscovery.js";

export interface HiringProcessSignal {
  mentionsSystemDesign: boolean;
  mentionsTakeHome: boolean;
  stages: string[];
  notes: string;
}

const STAGE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "phone screen", pattern: /phone screen|recruiter call|intro call/i },
  { label: "technical screen", pattern: /technical screen|coding (interview|challenge|test)/i },
  { label: "take-home assignment", pattern: /take[-\s]?home/i },
  { label: "system design round", pattern: /system design/i },
  { label: "onsite / final round", pattern: /on-?site|final round|panel interview/i },
  { label: "behavioural round", pattern: /behavioural interview|behavioral interview|culture fit interview/i },
];

/**
 * A hiring-process page, once found, should change what questions get
 * generated (Section 3) — e.g. a company that publishes a take-home followed
 * by a system-design round should produce a different kit from one that says
 * nothing. This is deterministic keyword detection rather than another LLM
 * call: cheap, reliable, and it only needs to gate which question category
 * gets generated, not produce prose.
 */
export function analyzeHiringProcess(
  pages: CrawledPage[],
  discussion: DiscussionSnippet[]
): HiringProcessSignal {
  const corpus = [...pages.map((p) => p.text), ...discussion.map((d) => d.content)].join("\n");

  const stages: string[] = [];
  const notes: string[] = [];
  for (const { label, pattern } of STAGE_PATTERNS) {
    const match = corpus.match(pattern);
    if (match) {
      stages.push(label);
      const idx = match.index ?? 0;
      notes.push(corpus.slice(Math.max(0, idx - 80), idx + 160).replace(/\s+/g, " ").trim());
    }
  }

  return {
    mentionsSystemDesign: stages.includes("system design round"),
    mentionsTakeHome: stages.includes("take-home assignment"),
    stages,
    notes: notes.join(" ... ").slice(0, 1200),
  };
}
