import { config } from "../config/env.js";
import { withRetry } from "../utils/retry.js";

export interface DiscussionSnippet {
  url: string;
  title: string;
  content: string;
}

export interface PublicDiscoveryResult {
  snippets: DiscussionSnippet[];
  searched: boolean;
  note?: string;
}

interface TavilyResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

/**
 * Looks for public discussion of a company's interview process (Glassdoor /
 * Blind / Reddit-style threads) via the Tavily search API, which is built for
 * exactly this kind of LLM-research query and returns already-cleaned
 * content snippets — no separate fetch/clean pass needed per result.
 *
 * Finding nothing is a valid, expected outcome (Section 10) — this never
 * throws for "no results," only for the search call itself being unusable.
 */
export async function findPublicDiscussion(companyName: string): Promise<PublicDiscoveryResult> {
  if (!config.TAVILY_API_KEY) {
    return { snippets: [], searched: false, note: "TAVILY_API_KEY not configured" };
  }

  const query = `${companyName} interview process questions experience`;

  try {
    const data = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            signal: controller.signal,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              api_key: config.TAVILY_API_KEY,
              query,
              search_depth: "basic",
              max_results: 5,
              include_answer: false,
            }),
          });
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`Tavily upstream error ${res.status}`);
          }
          if (!res.ok) {
            throw new Error(`Tavily error ${res.status}`);
          }
          return (await res.json()) as TavilyResponse;
        } finally {
          clearTimeout(timeout);
        }
      },
      { retries: 2 }
    );

    const snippets: DiscussionSnippet[] = (data.results ?? [])
      .filter((r) => r.url && r.content)
      .slice(0, 5)
      .map((r) => ({ url: r.url!, title: r.title ?? "", content: r.content!.slice(0, 3000) }));

    return { snippets, searched: true };
  } catch (err) {
    return {
      snippets: [],
      searched: true,
      note: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
