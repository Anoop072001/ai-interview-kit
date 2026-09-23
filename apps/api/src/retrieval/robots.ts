import robotsParserImport from "robots-parser";

// The package's own bundled .d.ts is self-contradictory under NodeNext
// module resolution (an ambient `declare module` shorthand alongside real
// exports), which makes TS lose the default export's call signature —
// this re-types it against the shape documented in its README instead.
export interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getMatchingLineNumber(url: string, ua?: string): number;
  getCrawlDelay(ua?: string): number | undefined;
  getSitemaps(): string[];
  getPreferredHost(): string | null;
}
const robotsParser = robotsParserImport as unknown as (url: string, robotstxt: string) => Robot;

const USER_AGENT = "AIInterviewKitBot/1.0 (+https://github.com/anoopsidhan18/ai-interview-kit)";
const cache = new Map<string, Robot | null>();

async function getRobots(origin: string, fetchImpl: typeof fetch): Promise<Robot | null> {
  if (cache.has(origin)) return cache.get(origin) ?? null;

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await fetchImpl(robotsUrl, { redirect: "follow" });
    if (!res.ok) {
      cache.set(origin, null);
      return null;
    }
    const body = await res.text();
    const robots = robotsParser(robotsUrl, body);
    cache.set(origin, robots);
    return robots;
  } catch {
    // No robots.txt, or it couldn't be fetched — treat as "no restrictions"
    // rather than failing the whole crawl over it.
    cache.set(origin, null);
    return null;
  }
}

export async function isAllowedByRobots(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  const robots = await getRobots(origin, fetchImpl);
  if (!robots) return true;
  const allowed = robots.isAllowed(url, USER_AGENT);
  return allowed !== false;
}

export { USER_AGENT };
