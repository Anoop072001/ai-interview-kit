import { fetchPage, PageFetchError } from "./fetchPage.js";
import { cleanHtml, extractLinks, type ExtractedLink } from "./htmlClean.js";
import { getPageClassifier } from "./pageClassifier.js";

export class CompanySiteUnreachableError extends Error {
  code = "COMPANY_UNREACHABLE";
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

export interface SkippedSource {
  url: string;
  reason: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  hiringPageUrl: string | null;
  skipped: SkippedSource[];
}

export interface CrawlOptions {
  allowLocal: boolean;
  maxPages: number;
}

// Link-level ranking: what's worth fetching at all. Deliberately not a fixed
// path list (Section 2 — "a fixed list of paths is not sufficient") — scores
// whatever links the homepage actually contains, in whatever language it uses.
const LINK_KEYWORDS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /career/i, weight: 3 },
  { pattern: /\bjobs?\b/i, weight: 3 },
  { pattern: /hiring/i, weight: 3 },
  { pattern: /join[-_ ]?us/i, weight: 2.5 },
  { pattern: /work[-_ ]?with[-_ ]?us/i, weight: 2 },
  { pattern: /open[-_ ]?(roles|positions)/i, weight: 2.5 },
  { pattern: /\babout\b/i, weight: 2 },
  { pattern: /\bteam\b/i, weight: 1.5 },
  { pattern: /\bculture\b/i, weight: 1.5 },
  { pattern: /\bmission\b/i, weight: 1 },
  { pattern: /\bhandbook\b/i, weight: 1.5 },
  { pattern: /\bblog\b/i, weight: 1 },
  { pattern: /interview/i, weight: 2 },
  { pattern: /life[-_ ]?at/i, weight: 1.5 },
  { pattern: /company/i, weight: 1 },
];

const NEGATIVE_KEYWORDS = /privacy|terms|cookie|login|sign[-_ ]?in|legal|sitemap|gdpr|contact/i;

function scoreLink(link: ExtractedLink): number {
  const haystack = `${link.url} ${link.text}`;
  if (NEGATIVE_KEYWORDS.test(haystack)) return -1;
  let score = 0;
  for (const { pattern, weight } of LINK_KEYWORDS) {
    if (pattern.test(haystack)) score += weight;
  }
  return score;
}

function rankLinks(links: ExtractedLink[], exclude: Set<string>): ExtractedLink[] {
  return links
    .filter((l) => !exclude.has(l.url))
    .map((l) => ({ link: l, score: scoreLink(l) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.link);
}

/**
 * Crawls a company site starting from its homepage: fetches the page, ranks
 * its own links by relevance (no hardcoded path list), fetches the top
 * candidates, and follows one more level from whichever page looks most like
 * the hiring page — bounded by `maxPages` total fetches so a run stays within
 * the batch time budget (Section 9).
 */
export async function crawlCompanySite(companyUrl: string, options: CrawlOptions): Promise<CrawlResult> {
  const { allowLocal, maxPages } = options;
  const classifier = getPageClassifier();

  const pages: CrawledPage[] = [];
  const skipped: SkippedSource[] = [];
  const visited = new Set<string>();
  const htmlByUrl = new Map<string, string>();

  let homepage;
  try {
    homepage = await fetchPage(companyUrl, { allowLocal });
  } catch (err) {
    throw new CompanySiteUnreachableError(
      err instanceof Error ? err.message : `Could not reach ${companyUrl}`
    );
  }

  visited.add(homepage.url);
  htmlByUrl.set(homepage.url, homepage.html);
  const homeClean = cleanHtml(homepage.html);
  pages.push({ url: homepage.url, title: homeClean.title, text: homeClean.text });

  const homeLinks = extractLinks(homepage.html, homepage.url);
  const ranked = rankLinks(homeLinks, visited);

  let hiringPageUrl: string | null = null;
  let bestHiringScore = 0;
  let depth2Candidate: string | null = null;

  for (const link of ranked) {
    if (pages.length >= maxPages) break;
    if (visited.has(link.url)) continue;
    visited.add(link.url);

    try {
      const fetched = await fetchPage(link.url, { allowLocal });
      htmlByUrl.set(fetched.url, fetched.html);
      const cleaned = cleanHtml(fetched.html);
      pages.push({ url: fetched.url, title: cleaned.title, text: cleaned.text });

      const classification = await classifier.classify({
        url: fetched.url,
        title: cleaned.title,
        text: cleaned.text,
        linkText: link.text,
      });
      if (classification.isHiringPage && classification.confidence > bestHiringScore) {
        bestHiringScore = classification.confidence;
        hiringPageUrl = fetched.url;
        depth2Candidate = fetched.url;
      }
    } catch (err) {
      skipped.push({ url: link.url, reason: describeError(err) });
    }
  }

  // One extra level from whichever page looked most like the hiring page —
  // companies often nest the real detail (interview stages, a handbook page)
  // one hop past the careers index.
  if (depth2Candidate && pages.length < maxPages) {
    const html = htmlByUrl.get(depth2Candidate);
    if (html) {
      const subLinks = rankLinks(extractLinks(html, depth2Candidate), visited).slice(
        0,
        maxPages - pages.length
      );
      for (const link of subLinks) {
        if (pages.length >= maxPages) break;
        if (visited.has(link.url)) continue;
        visited.add(link.url);
        try {
          const fetched = await fetchPage(link.url, { allowLocal });
          const cleaned = cleanHtml(fetched.html);
          pages.push({ url: fetched.url, title: cleaned.title, text: cleaned.text });
        } catch (err) {
          skipped.push({ url: link.url, reason: describeError(err) });
        }
      }
    }
  }

  return { pages, hiringPageUrl, skipped };
}

function describeError(err: unknown): string {
  if (err instanceof PageFetchError) return `${err.code}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
