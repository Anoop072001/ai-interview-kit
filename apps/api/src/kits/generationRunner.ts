import { KitModel } from "../models/Kit.js";
import { runPipeline, PipelineFailedError, type StepStatus } from "../pipeline/orchestrator.js";

interface StepRecord {
  name: string;
  status: StepStatus;
  message: string;
  startedAt?: Date;
  finishedAt?: Date;
}

async function persistSteps(kitId: string, steps: StepRecord[]): Promise<void> {
  try {
    await KitModel.findByIdAndUpdate(kitId, { $set: { "generation.steps": steps } });
  } catch {
    // Progress persistence is best-effort — a transient write failure here
    // must not abort the generation run itself.
  }
}

/**
 * Runs the pipeline for a given kit doc and persists progress as it goes, so
 * `GET /kits/:id/status` has something real to poll (Section 13 — generation
 * is slow, external and failure-prone; the interface needs visible
 * progress). Fire-and-forget from the caller's perspective: the HTTP request
 * that creates the kit returns immediately with status "pending".
 */
export async function startGeneration(
  kitId: string,
  input: { jd: string; companyUrl: string; days: number }
): Promise<void> {
  await KitModel.findByIdAndUpdate(kitId, { $set: { status: "running" } });

  const steps: StepRecord[] = [];
  // Each progress write fires without blocking the pipeline, but they must
  // still resolve in order and finish before the final status write —
  // otherwise the last step or two can lose the race against "status: ok"
  // and never get persisted, even though the pipeline genuinely ran them.
  let pendingWrite: Promise<void> = Promise.resolve();
  const onProgress = (name: string, status: StepStatus, message?: string) => {
    const existing = steps.find((s) => s.name === name);
    const now = new Date();
    if (existing) {
      existing.status = status;
      existing.message = message ?? existing.message;
      if (status === "running") existing.startedAt = now;
      if (status !== "running") existing.finishedAt = now;
    } else {
      steps.push({ name, status, message: message ?? "", startedAt: status === "running" ? now : undefined, finishedAt: status !== "running" ? now : undefined });
    }
    pendingWrite = pendingWrite.then(() => persistSteps(kitId, steps));
  };

  try {
    const kit = await runPipeline(input, { allowLocal: false, onProgress });
    await pendingWrite;
    await KitModel.findByIdAndUpdate(kitId, { $set: { status: "ok", kit, "generation.error": null } });
  } catch (err) {
    const code = err instanceof PipelineFailedError ? err.code : "PIPELINE_ERROR";
    const message = err instanceof Error ? err.message : String(err);
    await pendingWrite;
    await KitModel.findByIdAndUpdate(kitId, {
      $set: { status: "failed", "generation.error": { code, message } },
    });
  }
}
