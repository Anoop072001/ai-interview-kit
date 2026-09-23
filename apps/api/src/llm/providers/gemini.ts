import { config } from "../../config/env.js";
import { withRetry } from "../../utils/retry.js";
import type { LlmProvider } from "../client.js";

/**
 * Genuine-free-tier alternative to OpenAI (LLM_PROVIDER=gemini). Implemented
 * directly against the REST API rather than adding an SDK dependency, using
 * Gemini's native JSON response mode.
 */
export function createGeminiProvider(): LlmProvider {
  const model = config.GEMINI_MODEL;

  return {
    async completeJSON(system: string, prompt: string): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`;

      return withRetry(
        async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
            }),
          });

          if (res.status === 429 || res.status >= 500) {
            throw new Error(`Gemini upstream error ${res.status}`);
          }
          if (!res.ok) {
            throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
          }

          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error("Empty response from Gemini");
          return text;
        },
        { retries: 3, shouldRetry: (err) => /upstream error/i.test(String(err)) }
      );
    },
  };
}
