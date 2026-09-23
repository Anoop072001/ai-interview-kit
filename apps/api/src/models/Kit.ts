import { Schema, model, Types, type InferSchemaType } from "mongoose";

const generationStepSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "done", "failed", "skipped"],
      default: "pending",
    },
    message: { type: String, default: "" },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { _id: false }
);

const kitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Original inputs, kept so a section can be regenerated later without
    // re-asking the user to paste the JD again.
    jd: { type: String, required: true },
    companyUrl: { type: String, required: true },
    daysRequested: { type: Number, required: true },

    // Hash of (userId + jd + company_url) — lets us detect and short-circuit
    // duplicate submissions instead of re-running the pipeline (Section 10).
    contentHash: { type: String, required: true, index: true },

    // Overall lifecycle status of this kit's generation.
    status: {
      type: String,
      enum: ["pending", "running", "ok", "failed"],
      default: "pending",
      index: true,
    },

    generation: {
      steps: { type: [generationStepSchema], default: [] },
      error: {
        type: new Schema({ code: String, message: String }, { _id: false }),
        default: null,
      },
    },

    // The Appendix A structure. Kept as Mixed rather than a duplicated Mongoose
    // schema — the single source of truth for its shape is the zod schema in
    // @aik/shared, enforced at the application boundary before every save.
    kit: { type: Schema.Types.Mixed, default: null },

    // Practice Mode history — not part of the Appendix A structure (it's
    // user activity, not generated content), so it lives as its own field
    // rather than inside `kit`.
    practice: {
      type: [
        new Schema(
          {
            flashcardId: { type: String, required: true },
            confidence: { type: Number, required: true, min: 1, max: 5 },
            attemptedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

kitSchema.index({ userId: 1, contentHash: 1 });

export type KitDoc = InferSchemaType<typeof kitSchema> & { _id: Types.ObjectId };
export const KitModel = model("Kit", kitSchema);
