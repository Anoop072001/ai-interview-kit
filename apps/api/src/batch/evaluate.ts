#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import pLimit from "p-limit";
import { batchCaseInputSchema, type BatchResult, type BatchOutput } from "@aik/shared";
import { config } from "../config/env.js";
import { runPipeline, PipelineFailedError } from "../pipeline/orchestrator.js";

function parseArgs(argv: string[]): { input: string; output: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.input || !args.output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input: args.input, output: args.output };
}

async function runCase(caseInput: { id: string; jd: string; company_url: string; days: number }): Promise<BatchResult> {
  try {
    // The batch harness's company sites may be served from a local address
    // (Section 9) — allowLocal is only ever true here and in local dev, never
    // for the live application handling real user submissions.
    const kit = await runPipeline(
      { jd: caseInput.jd, companyUrl: caseInput.company_url, days: caseInput.days },
      { allowLocal: true, onProgress: (step, status, message) => {
          console.log(`[${caseInput.id}] ${step}: ${status}${message ? ` — ${message}` : ""}`);
        } }
    );
    return { id: caseInput.id, status: "ok", kit, error: null };
  } catch (err) {
    const code = err instanceof PipelineFailedError ? err.code : "UNEXPECTED_ERROR";
    const message = err instanceof Error ? err.message : String(err);
    return { id: caseInput.id, status: "failed", kit: null, error: { code, message } };
  }
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));

  const raw = await readFile(input, "utf-8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.error(`Could not parse ${input} as JSON: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (!Array.isArray(parsedJson)) {
    console.error(`${input} must contain a JSON array of cases`);
    process.exit(1);
  }

  const results: BatchResult[] = [];
  const validCases: Array<{ id: string; jd: string; company_url: string; days: number }> = [];

  // Validate cases individually — a malformed case is recorded as failed,
  // it does not abort the whole run (Section 9).
  for (const [index, entry] of parsedJson.entries()) {
    const parsed = batchCaseInputSchema.element.safeParse(entry);
    if (parsed.success) {
      validCases.push(parsed.data);
    } else {
      const fallbackId = (entry as { id?: string })?.id ?? `case-${index}`;
      results.push({
        id: fallbackId,
        status: "failed",
        kit: null,
        error: { code: "INVALID_CASE", message: parsed.error.issues.map((i) => i.message).join("; ") },
      });
    }
  }

  const limit = pLimit(config.BATCH_CONCURRENCY);
  const caseResults = await Promise.all(validCases.map((c) => limit(() => runCase(c))));
  results.push(...caseResults);

  const output_: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  await writeFile(output, JSON.stringify(output_, null, 2), "utf-8");

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`Wrote ${results.length} result(s) to ${output} (${okCount} ok, ${results.length - okCount} failed)`);
}

main().catch((err) => {
  console.error("Batch run failed:", err);
  process.exit(1);
});
