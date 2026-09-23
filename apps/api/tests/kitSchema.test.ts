import { describe, it, expect } from "vitest";
import { kitSchema } from "@aik/shared";

function validKit() {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.example.com",
      role: "Backend Engineer",
      location: "Remote",
      jd_chars: 500,
      researched_at: new Date().toISOString(),
      pages_used: ["https://acme.example.com/careers"],
    },
    company_brief: {
      summary: "Acme builds widgets.",
      what_they_do: "Widgets as a service.",
      sources: ["https://acme.example.com/about"],
    },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Build APIs"],
      requirements: [{ id: "r1", text: "5+ years with Node.js", kind: "technical", priority: "must" }],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain event loop phases.",
        answer_outline: "Cover timers, I/O, close callbacks.",
        difficulty: 2,
        state: "generated",
      },
    ],
    flashcards: [{ id: "f1", front: "What is the event loop?", back: "...", requirement_ids: ["r1"] }],
    schedule: { days_available: 1, days: [{ day: 1, focus: "Technical", question_ids: ["q1"], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("kitSchema (Appendix A)", () => {
  it("accepts a well-formed kit", () => {
    expect(kitSchema.safeParse(validKit()).success).toBe(true);
  });

  it("rejects a requirement with an invalid priority", () => {
    const kit = validKit();
    // @ts-expect-error deliberately invalid for the test
    kit.role.requirements[0].priority = "medium";
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("rejects a requirement with an invalid kind", () => {
    const kit = validKit();
    // @ts-expect-error deliberately invalid for the test
    kit.role.requirements[0].kind = "soft-skill";
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("rejects a question category outside the fixed enum", () => {
    const kit = validKit();
    // @ts-expect-error deliberately invalid for the test
    kit.questions[0].category = "trivia";
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("rejects non-integer minutes", () => {
    const kit = validKit();
    kit.schedule.days[0].minutes = 30.5;
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("rejects difficulty outside 1-3", () => {
    const kit = validKit();
    kit.questions[0].difficulty = 4;
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("requires role.requirements to be present", () => {
    const kit = validKit();
    // @ts-expect-error deliberately invalid for the test
    delete kit.role.requirements;
    expect(kitSchema.safeParse(kit).success).toBe(false);
  });

  it("defaults question/flashcard state to 'generated' when omitted", () => {
    const kit = validKit();
    // @ts-expect-error state omitted deliberately
    delete kit.flashcards[0].state;
    const result = kitSchema.safeParse(kit);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.flashcards[0].state).toBe("generated");
  });
});
