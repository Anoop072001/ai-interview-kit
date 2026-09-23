import "dotenv/config";
import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  PORT: z.string().default("4000").transform(Number),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),

  LLM_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),

  TAVILY_API_KEY: z.string().optional().default(""),

  USE_JEV_CLASSIFIER: boolFromString,
  JEV_API_KEY: z.string().optional().default(""),

  ALLOW_LOCAL_HOSTS: boolFromString,

  MAX_CRAWL_PAGES: z.string().default("8").transform(Number),
  MAX_COVERAGE_PASSES: z.string().default("3").transform(Number),
  BATCH_CONCURRENCY: z.string().default("2").transform(Number),
  // Caps how many kit pipelines the live app runs at once, regardless of
  // entry point (single create, bulk upload) — protects the LLM provider's
  // rate limit the same way BATCH_CONCURRENCY does for the CLI.
  MAX_CONCURRENT_GENERATIONS: z.string().default("2").transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === "production";
