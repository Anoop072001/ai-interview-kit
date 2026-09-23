import * as cheerio from "cheerio";

const BOILERPLATE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  "svg",
  "iframe",
  "[aria-hidden='true']",
];

const MAX_TEXT_CHARS = 20_000;

export interface CleanedPage {
  title: string;
  text: string;
}

/** Strips boilerplate and returns the readable main text of a page, capped
 * to keep prompts a reasonable size (Section 3: "retrieve and clean an
 * individual page"). */
export function cleanHtml(html: string): CleanedPage {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();

  BOILERPLATE_SELECTORS.forEach((sel) => $(sel).remove());

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);

  return { title, text };
}

export interface ExtractedLink {
  url: string;
  text: string;
}

/** Extracts same-origin links with their anchor text, for the crawler to rank. */
export function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: ExtractedLink[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }
    resolved.hash = "";
    if (resolved.origin !== base.origin) return;
    if (!["http:", "https:"].includes(resolved.protocol)) return;

    const url = resolved.toString();
    if (seen.has(url)) return;
    seen.add(url);

    links.push({ url, text: $(el).text().replace(/\s+/g, " ").trim() });
  });

  return links;
}
