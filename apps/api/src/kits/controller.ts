import type { Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { KitModel } from "../models/Kit.js";
import { contentHash } from "../utils/hash.js";
import { startGeneration } from "./generationRunner.js";
import * as kitService from "./kitService.js";
import { regenerateSection, type RegeneratableSection } from "../pipeline/regenerate.js";
import { buildPracticeSession, type PracticeAttempt } from "./practiceService.js";
import { kitSchema, questionCategorySchema } from "@aik/shared";

const createKitSchema = z.object({
  jd: z.string().trim().min(1, "Job description is required"),
  companyUrl: z.string().trim().url("companyUrl must be a valid URL"),
  days: z.number().int().min(1).max(60),
});

function badRequest(res: Response, message: string) {
  res.status(400).json({ error: { code: "INVALID_INPUT", message } });
}

async function loadOwnedKit(req: Request, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such kit" } });
    return null;
  }
  const doc = await KitModel.findById(id);
  if (!doc || doc.userId.toString() !== req.session.userId) {
    // Same response whether it doesn't exist or belongs to someone else —
    // don't leak which kits exist to a user who doesn't own them.
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such kit" } });
    return null;
  }
  return doc;
}

async function createKitForUser(
  userId: string,
  input: { jd: string; companyUrl: string; days: number }
): Promise<{ id: string; status: string; deduplicated: boolean }> {
  const { jd, companyUrl, days } = input;
  const hash = contentHash([userId, jd, companyUrl]);

  const existing = await KitModel.findOne({ userId, contentHash: hash });
  if (existing) {
    // Section 10: the same description + company submitted twice returns
    // the existing kit rather than paying for a second generation run.
    return { id: existing.id, status: existing.status, deduplicated: true };
  }

  const doc = await KitModel.create({
    userId,
    jd,
    companyUrl,
    daysRequested: days,
    contentHash: hash,
    status: "pending",
    generation: { steps: [], error: null },
    kit: null,
  });

  void startGeneration(doc.id, { jd, companyUrl, days });

  return { id: doc.id, status: doc.status, deduplicated: false };
}

export async function createKit(req: Request, res: Response) {
  const parsed = createKitSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid input");

  const result = await createKitForUser(req.session.userId!, parsed.data);
  res.status(result.deduplicated ? 200 : 202).json(result);
}

const bulkCaseSchema = z.object({
  jd: z.string().trim().min(1),
  company_url: z.string().trim().url(),
  days: z.number().int().min(1).max(60),
});

const bulkCreateSchema = z.object({
  cases: z.array(z.unknown()).min(1, "At least one case is required").max(50, "At most 50 cases per upload"),
});

/**
 * The "prepare for more than one role at once by uploading a file" path
 * (Section 2). Each case is validated independently and a bad one is
 * reported rather than failing the whole upload — same principle as the
 * batch CLI's per-case error handling, just creating real owned Kit docs
 * (via the same createKitForUser/startGeneration path as a single kit)
 * instead of writing a result file.
 */
export async function createBulkKits(req: Request, res: Response) {
  const parsed = bulkCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid input");

  const userId = req.session.userId!;
  const results = await Promise.all(
    parsed.data.cases.map(async (raw, index) => {
      const caseParsed = bulkCaseSchema.safeParse(raw);
      if (!caseParsed.success) {
        return { index, id: null, status: "invalid", error: caseParsed.error.issues[0]?.message };
      }
      const { jd, company_url: companyUrl, days } = caseParsed.data;
      const result = await createKitForUser(userId, { jd, companyUrl, days });
      return { index, id: result.id, status: result.status };
    })
  );

  res.status(202).json({ results });
}

export async function listKits(req: Request, res: Response) {
  const docs = await KitModel.find({ userId: req.session.userId })
    .select({ jd: 0, "kit.questions": 0, "kit.flashcards": 0 })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    kits: docs.map((d) => ({
      id: d._id.toString(),
      status: d.status,
      companyUrl: d.companyUrl,
      daysRequested: d.daysRequested,
      company: d.kit?.source?.company ?? null,
      role: d.kit?.source?.role ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
}

export async function getKit(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc) return;
  res.json({
    id: doc.id,
    status: doc.status,
    companyUrl: doc.companyUrl,
    daysRequested: doc.daysRequested,
    generation: doc.generation,
    kit: doc.kit,
  });
}

export async function getKitStatus(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc) return;
  res.json({ id: doc.id, status: doc.status, generation: doc.generation });
}

const sectionSchema = z.union([questionCategorySchema, z.literal("company_brief"), z.literal("flashcards"), z.literal("schedule")]);

export async function regenerate(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc) return;
  if (!doc.kit) return badRequest(res, "Kit has not finished generating yet");

  const parsed = sectionSchema.safeParse(req.body?.section);
  if (!parsed.success) return badRequest(res, "body.section must be a valid kit section");

  const currentKit = kitSchema.parse(doc.kit);
  try {
    const updated = await regenerateSection(currentKit, parsed.data as RegeneratableSection, { allowLocal: false });
    doc.kit = updated;
    await doc.save();
    res.json({ id: doc.id, kit: updated });
  } catch (err) {
    res.status(502).json({ error: { code: "REGENERATE_FAILED", message: err instanceof Error ? err.message : String(err) } });
  }
}

// --- Questions ---------------------------------------------------------

const questionInputSchema = z.object({
  requirement_ids: z.array(z.string()),
  category: questionCategorySchema,
  prompt: z.string().min(1),
  answer_outline: z.string().default(""),
  difficulty: z.number().int().min(1).max(3),
});

export async function addQuestion(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  const parsed = questionInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid question");

  const updated = kitService.addQuestion(kitSchema.parse(doc.kit), parsed.data);
  doc.kit = updated;
  await doc.save();
  res.status(201).json({ kit: updated });
}

export async function editQuestion(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  try {
    const updated = kitService.editQuestion(kitSchema.parse(doc.kit), req.params.qid, req.body ?? {});
    doc.kit = updated;
    await doc.save();
    res.json({ kit: updated });
  } catch (err) {
    badRequest(res, err instanceof Error ? err.message : String(err));
  }
}

export async function deleteQuestion(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  doc.kit = kitService.deleteQuestion(kitSchema.parse(doc.kit), req.params.qid);
  await doc.save();
  res.json({ kit: doc.kit });
}

const reorderSchema = z.object({ category: questionCategorySchema, orderedIds: z.array(z.string()) });

export async function reorderQuestions(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "body must be { category, orderedIds }");

  try {
    doc.kit = kitService.reorderQuestions(kitSchema.parse(doc.kit), parsed.data.category, parsed.data.orderedIds);
    await doc.save();
    res.json({ kit: doc.kit });
  } catch (err) {
    badRequest(res, err instanceof Error ? err.message : String(err));
  }
}

// --- Flashcards ----------------------------------------------------------

const flashcardInputSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).default([]),
});

export async function addFlashcard(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  const parsed = flashcardInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid flashcard");

  doc.kit = kitService.addFlashcard(kitSchema.parse(doc.kit), parsed.data);
  await doc.save();
  res.status(201).json({ kit: doc.kit });
}

export async function editFlashcard(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  try {
    doc.kit = kitService.editFlashcard(kitSchema.parse(doc.kit), req.params.fid, req.body ?? {});
    await doc.save();
    res.json({ kit: doc.kit });
  } catch (err) {
    badRequest(res, err instanceof Error ? err.message : String(err));
  }
}

export async function deleteFlashcard(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  doc.kit = kitService.deleteFlashcard(kitSchema.parse(doc.kit), req.params.fid);
  await doc.save();
  res.json({ kit: doc.kit });
}

export async function editCompanyBrief(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  doc.kit = kitService.editCompanyBrief(kitSchema.parse(doc.kit), req.body ?? {});
  await doc.save();
  res.json({ kit: doc.kit });
}

// --- Practice mode ---------------------------------------------------------

const attemptSchema = z.object({ flashcardId: z.string(), confidence: z.number().int().min(1).max(5) });

export async function recordPracticeAttempt(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "body must be { flashcardId, confidence: 1-5 }");

  const exists = kitSchema.parse(doc.kit).flashcards.some((f) => f.id === parsed.data.flashcardId);
  if (!exists) return badRequest(res, "No such flashcard in this kit");

  doc.practice.push({ ...parsed.data, attemptedAt: new Date() });
  await doc.save();
  res.status(201).json({ ok: true });
}

export async function getPracticeSession(req: Request, res: Response) {
  const doc = await loadOwnedKit(req, res);
  if (!doc || !doc.kit) return;

  const kit = kitSchema.parse(doc.kit);
  const attempts: PracticeAttempt[] = doc.practice.map((p) => ({
    flashcardId: p.flashcardId,
    confidence: p.confidence,
    attemptedAt: p.attemptedAt,
  }));

  res.json(buildPracticeSession(kit.flashcards, attempts));
}
