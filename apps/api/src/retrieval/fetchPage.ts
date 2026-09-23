import { assertUrlIsFetchable } from "./urlValidator.js";
import { isAllowedByRobots, USER_AGENT } from "./robots.js";
import { withRetry } from "../utils/retry.js";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_INTERVAL_PER_ORIGIN_MS = 500;

const lastRequestAt = new Map<string, number>();

async function rateLimit(origin: string): Promise<void> {
  const last = lastRequestAt.get(origin) ?? 0;
  const wait = last + MIN_INTERVAL_PER_ORIGIN_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(origin, Date.now());
}

export class PageFetchError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

export interface FetchedPage {
  url: string;
  html: string;
  contentType: string;
}

export interface FetchPageOptions {
  allowLocal: boolean;
  respectRobots?: boolean;
}

/**
 * Fetches a single page: validates the URL (SSRF guard), honours robots.txt,
 * rate-limits per origin, enforces a content-type allowlist and size cap, and
 * retries with backoff on transient failures (Section 2, Section 11).
 */
export async function fetchPage(url: string, options: FetchPageOptions): Promise<FetchedPage> {
  const parsed = await assertUrlIsFetchable(url, { allowLocal: options.allowLocal });

  if (options.respectRobots !== false) {
    const allowed = await isAllowedByRobots(parsed.toString());
    if (!allowed) throw new PageFetchError(`Disallowed by robots.txt: ${url}`, "ROBOTS_DISALLOWED");
  }

  await rateLimit(parsed.origin);

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(parsed.toString(), {
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        });

        if (res.status === 429 || res.status >= 500) {
          throw new PageFetchError(`Upstream error ${res.status} for ${url}`, "UPSTREAM_ERROR");
        }
        if (!res.ok) {
          throw new PageFetchError(`HTTP ${res.status} for ${url}`, "HTTP_ERROR");
        }

        const contentType = res.headers.get("content-type") ?? "";
        const baseType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
        if (!ALLOWED_CONTENT_TYPES.includes(baseType)) {
          throw new PageFetchError(`Unsupported content-type "${baseType}" for ${url}`, "BAD_CONTENT_TYPE");
        }

        const contentLength = Number(res.headers.get("content-length") ?? "0");
        if (contentLength > MAX_BYTES) {
          throw new PageFetchError(`Page too large (${contentLength} bytes): ${url}`, "TOO_LARGE");
        }

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > MAX_BYTES) {
          throw new PageFetchError(`Page too large (${buffer.byteLength} bytes): ${url}`, "TOO_LARGE");
        }

        const html = Buffer.from(buffer).toString("utf-8");
        return { url: parsed.toString(), html, contentType: baseType };
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      retries: 2,
      shouldRetry: (err) => err instanceof PageFetchError && err.code === "UPSTREAM_ERROR",
    }
  );
}
