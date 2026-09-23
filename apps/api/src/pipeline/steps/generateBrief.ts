import { z } from "zod";
import { generateStructured } from "../../llm/client.js";
import type { CrawledPage } from "../../retrieval/siteCrawler.js";
import type { DiscussionSnippet } from "../../retrieval/publicDiscovery.js";
import { wrapUntrusted, SAFETY_INSTRUCTION } from "../../utils/promptSafety.js";

const briefOutputSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
});

export interface GeneratedBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

const SYSTEM_PROMPT = `You are summarizing a company for someone preparing for a job interview there.
${SAFETY_INSTRUCTION}

Rules:
- Base everything ONLY on the provided page content and discussion snippets. Never invent facts, products, funding history, or culture claims that aren't grounded in the given text.
- If the provided material is thin or largely irrelevant, say so plainly in "summary" (e.g. "Limited public information was found about this company.") rather than filling in generic-sounding claims.
- Keep "what_they_do" concrete and specific to what the pages actually say the company builds/sells/does.`;

export async function generateBrief(
  companyUrl: string,
  pages: CrawledPage[],
  discussion: DiscussionSnippet[]
): Promise<GeneratedBrief> {
  const sources = [...pages.map((p) => p.url), ...discussion.map((d) => d.url)];

  if (pages.length === 0 && discussion.length === 0) {
    return {
      summary: `No usable information could be retrieved about the company at ${companyUrl}. The site may be unreachable, disallow crawling, or have no public content our crawler could find.`,
      what_they_do: "",
      sources: [],
    };
  }

  const pageBlocks = pages
    .map((p, i) => wrapUntrusted(`company_page_${i + 1}:${p.url}`, `${p.title}\n${p.text.slice(0, 3000)}`))
    .join("\n\n");
  const discussionBlocks = discussion
    .map((d, i) => wrapUntrusted(`discussion_${i + 1}:${d.url}`, d.content))
    .join("\n\n");

  const prompt = `Write a company brief for someone about to interview here, using only the material below.

${pageBlocks}

${discussionBlocks || "(No public discussion of this company was found.)"}

Return JSON: { "summary": string (2-4 sentences, what an interview candidate should know), "what_they_do": string (1-2 sentences, concrete product/business description) }`;

  const result = await generateStructured(briefOutputSchema, SYSTEM_PROMPT, prompt);

  return { ...result, sources };
}
