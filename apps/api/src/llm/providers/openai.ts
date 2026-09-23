import OpenAI from "openai";
import { config } from "../../config/env.js";
import { withRetry } from "../../utils/retry.js";
import type { LlmProvider } from "../client.js";

export function createOpenAiProvider(): LlmProvider {
  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  return {
    async completeJSON(system: string, prompt: string): Promise<string> {
      return withRetry(
        async () => {
          const res = await client.chat.completions.create({
            model: config.OPENAI_MODEL,
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: `${system}\nRespond with JSON only.` },
              { role: "user", content: prompt },
            ],
          });
          const content = res.choices[0]?.message?.content;
          if (!content) throw new Error("Empty response from OpenAI");
          return content;
        },
        {
          retries: 3,
          shouldRetry: (err) => {
            const status = (err as { status?: number })?.status;
            return status === 429 || (typeof status === "number" && status >= 500);
          },
          retryAfterMs: (err) => {
            const headers = (err as { headers?: Record<string, string> })?.headers;
            const retryAfter = headers?.["retry-after"];
            return retryAfter ? Number(retryAfter) * 1000 : undefined;
          },
        }
      );
    },
  };
}
