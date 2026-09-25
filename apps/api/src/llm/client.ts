import { z } from "zod";
import { createOpenAiProvider } from "./providers/openai.js";

/** A provider's only job: given a system + user prompt, return raw text that
 * is expected (but not guaranteed) to be JSON. Kept as an interface (rather
 * than calling the OpenAI SDK directly everywhere) purely so it's easy to
 * swap or mock in tests — OpenAI is the only provider this app uses. */
export interface LlmProvider {
  completeJSON(system: string, prompt: string): Promise<string>;
}

let cachedProvider: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (!cachedProvider) cachedProvider = createOpenAiProvider();
  return cachedProvider;
}

export class LlmGenerationError extends Error {
  code = "LLM_INVALID_OUTPUT";
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Runs a single-purpose LLM call and validates the result against a zod
 * schema. On invalid JSON / schema mismatch, re-prompts once with the error
 * so the model can repair its own output; a second failure is surfaced as
 * LlmGenerationError so the calling pipeline step can record it as a failure
 * rather than saving a malformed kit (Section 10).
 */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  provider: LlmProvider = getLlmProvider()
): Promise<T> {
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const effectivePrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous response was invalid: ${lastError}\nReturn ONLY valid JSON matching the required shape, with no commentary or markdown fences.`;

    const raw = await provider.completeJSON(system, effectivePrompt);
    const jsonText = extractJsonBlock(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      lastError = `Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    lastError = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }

  throw new LlmGenerationError(`LLM did not return a valid response: ${lastError}`);
}
