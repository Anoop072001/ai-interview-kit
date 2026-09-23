import { describe, it, expect } from "vitest";
import * as kitService from "../src/kits/kitService.js";
import type { Kit } from "@aik/shared";

function baseKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.example.com",
      role: "Backend Engineer",
      location: "",
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: { summary: "s", what_they_do: "w", sources: [] },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: [],
      requirements: [{ id: "r1", text: "Node.js", kind: "technical", priority: "must" }],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Original prompt",
        answer_outline: "",
        difficulty: 2,
        state: "generated",
      },
      {
        id: "q2",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Second",
        answer_outline: "",
        difficulty: 1,
        state: "generated",
      },
    ],
    flashcards: [],
    schedule: { days_available: 1, days: [{ day: 1, focus: "x", question_ids: ["q1", "q2"], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("kitService — the edit/generated/pinned state model", () => {
  it("marks a hand-added question as pinned", () => {
    const kit = kitService.addQuestion(baseKit(), {
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Hand-written question",
      answer_outline: "",
      difficulty: 1,
    });

    const added = kit.questions.at(-1)!;
    expect(added.state).toBe("pinned");
    expect(added.prompt).toBe("Hand-written question");
  });

  it("marks an edited generated question as edited, not pinned", () => {
    const kit = kitService.editQuestion(baseKit(), "q1", { prompt: "Edited prompt" });
    const edited = kit.questions.find((q) => q.id === "q1")!;
    expect(edited.state).toBe("edited");
    expect(edited.prompt).toBe("Edited prompt");
  });

  it("editing a pinned question leaves it pinned rather than downgrading to edited", () => {
    const withPinned = kitService.addQuestion(baseKit(), {
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Hand-written",
      answer_outline: "",
      difficulty: 1,
    });
    const pinnedId = withPinned.questions.at(-1)!.id;

    const kit = kitService.editQuestion(withPinned, pinnedId, { prompt: "Hand-written, refined" });
    expect(kit.questions.find((q) => q.id === pinnedId)!.state).toBe("pinned");
  });

  it("deleting a question removes only that question", () => {
    const kit = kitService.deleteQuestion(baseKit(), "q1");
    expect(kit.questions.map((q) => q.id)).toEqual(["q2"]);
  });

  it("reorders questions within a category without touching other categories", () => {
    const kit = kitService.reorderQuestions(baseKit(), "technical", ["q2", "q1"]);
    expect(kit.questions.map((q) => q.id)).toEqual(["q2", "q1"]);
  });

  it("rejects a reorder whose ids don't match the category's current question ids", () => {
    expect(() => kitService.reorderQuestions(baseKit(), "technical", ["q1"])).toThrow();
  });
});
