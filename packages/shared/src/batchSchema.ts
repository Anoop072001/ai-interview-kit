import { z } from "zod";
import { kitSchema } from "./kitSchema.js";

/** Mirrors Appendix B exactly. */

export const batchCaseSchema = z.object({
  id: z.string().min(1),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().min(1),
});

export const batchCaseInputSchema = z.array(batchCaseSchema);

export const batchErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const batchResultSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: kitSchema.nullable(),
  error: batchErrorSchema.nullable(),
});

export const batchOutputSchema = z.object({
  version: z.literal("1.0"),
  generated_at: z.string(),
  kits: z.array(batchResultSchema),
});

export type BatchCase = z.infer<typeof batchCaseSchema>;
export type BatchError = z.infer<typeof batchErrorSchema>;
export type BatchResult = z.infer<typeof batchResultSchema>;
export type BatchOutput = z.infer<typeof batchOutputSchema>;
