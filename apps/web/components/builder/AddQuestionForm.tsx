"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, TextArea } from "@/components/ui/Field";
import type { Requirement, QuestionCategory } from "@/lib/types";

export function AddQuestionForm({
  category,
  requirements,
  onAdd,
  adding,
}: {
  category: QuestionCategory;
  requirements: Requirement[];
  onAdd: (input: { requirement_ids: string[]; category: QuestionCategory; prompt: string; answer_outline: string; difficulty: number }) => void;
  adding: boolean;
}) {
  const promptId = useId();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answerOutline, setAnswerOutline] = useState("");
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start">
        + Add a question
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!prompt.trim() || !requirementId) return;
        onAdd({ requirement_ids: [requirementId], category, prompt, answer_outline: answerOutline, difficulty: 2 });
        setPrompt("");
        setAnswerOutline("");
        setOpen(false);
      }}
    >
      <label htmlFor={promptId} className="text-xs font-medium text-slate-500">
        Question prompt
      </label>
      <TextArea id={promptId} required rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />

      <label className="text-xs font-medium text-slate-500">Answer outline (optional)</label>
      <TextArea rows={2} value={answerOutline} onChange={(e) => setAnswerOutline(e.target.value)} />

      <label className="text-xs font-medium text-slate-500">Requirement it covers</label>
      <Select value={requirementId} onChange={(e) => setRequirementId(e.target.value)} className="w-auto">
        {requirements.map((r) => (
          <option key={r.id} value={r.id}>
            {r.text}
          </option>
        ))}
      </Select>

      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={adding}>
          Add
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
