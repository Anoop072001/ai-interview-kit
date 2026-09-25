import { config } from "../config/env.js";

export interface ClassifierInput {
  url: string;
  title: string;
  text: string;
  linkText: string;
}

export interface ClassificationResult {
  isHiringPage: boolean;
  confidence: number; // 0-1
  source: "heuristic" | "jev";
}

export interface PageClassifier {
  classify(input: ClassifierInput): Promise<ClassificationResult>;
}

const URL_KEYWORDS = ["career", "job", "hiring", "join-us", "join_us", "work-with-us", "open-roles", "positions"];
const CONTENT_KEYWORDS = [
  "we're hiring",
  "open positions",
  "open roles",
  "join our team",
  "current openings",
  "apply now",
  "interview process",
  "how we hire",
  "life at",
  "benefits",
  "employee benefits",
  "engineering blog",
];

/**
 * Zero-cost default: scores a page by keyword presence in its URL, title and
 * anchor text. This is what actually needs to work reliably — it has no
 * external dependency and no rate limit.
 */
export class HeuristicPageClassifier implements PageClassifier {
  async classify(input: ClassifierInput): Promise<ClassificationResult> {
    const haystack = `${input.url} ${input.title} ${input.linkText}`.toLowerCase();
    const bodyLower = input.text.toLowerCase();

    let score = 0;
    for (const kw of URL_KEYWORDS) {
      if (haystack.includes(kw)) score += 0.35;
    }
    for (const kw of CONTENT_KEYWORDS) {
      if (bodyLower.includes(kw)) score += 0.15;
    }

    const confidence = Math.min(1, score);
    return { isHiringPage: confidence >= 0.35, confidence, source: "heuristic" };
  }
}

interface SystemOneResponse {
  answers?: {
    is_hiring_page?: { type: "noul"; noul: number };
  };
}

/**
 * Optional upgrade using Jev (TypeSafe AI's decision-only model) via their
 * "systemone" endpoint. Best-effort only: this assessment requires a genuine
 * free-tier pipeline and Jev is not free, so it is never load-bearing — any
 * failure (missing key, non-2xx, timeout, unexpected response shape) falls
 * straight back to the heuristic classifier below.
 *
 * Schema confirmed directly against https://docs.typesafe.ai/api and a real
 * request/response round trip — "noul" questions return a 0-1 score for how
 * true the criteria's "true" case is, which doubles as our confidence value.
 */
export class JevPageClassifier implements PageClassifier {
  constructor(
    private apiKey: string,
    private fallback: PageClassifier = new HeuristicPageClassifier()
  ) {}

  async classify(input: ClassifierInput): Promise<ClassificationResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "jev-latest",
          state: `URL: ${input.url}\nTitle: ${input.title}\nLink text: ${input.linkText}\nContent: ${input.text.slice(0, 4000)}`,
          questions: {
            is_hiring_page: {
              type: "noul",
              instructions:
                "Does this webpage describe how the company hires, its careers/jobs page, or its interview process?",
              criteria: {
                true: "The page is a careers/jobs page, hiring page, or describes the interview process",
                false: "The page is unrelated to hiring, careers, or interviews",
              },
            },
          },
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) return this.fallback.classify(input);

      const data = (await res.json()) as SystemOneResponse;
      const noul = data.answers?.is_hiring_page?.noul;
      if (typeof noul !== "number") return this.fallback.classify(input);

      return { isHiringPage: noul >= 0.5, confidence: noul, source: "jev" };
    } catch {
      return this.fallback.classify(input);
    }
  }
}

let cached: PageClassifier | null = null;

export function getPageClassifier(): PageClassifier {
  if (cached) return cached;
  cached =
    config.USE_JEV_CLASSIFIER && config.JEV_API_KEY
      ? new JevPageClassifier(config.JEV_API_KEY)
      : new HeuristicPageClassifier();
  return cached;
}
