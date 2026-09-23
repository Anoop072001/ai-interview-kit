"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, TextArea } from "@/components/ui/Field";
import type { Question, QuestionCategory } from "@/lib/types";

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "system-design", label: "System design" },
  { value: "company-fit", label: "Company fit" },
];

export function QuestionCard({
  question,
  requirementText,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onSave,
  onDelete,
  onCategoryChange,
  saving,
}: {
  question: Question;
  requirementText: (id: string) => string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onCategoryChange: (category: QuestionCategory) => void;
  saving: boolean;
}) {
  const promptId = useId();
  const answerId = useId();
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [answerOutline, setAnswerOutline] = useState(question.answer_outline);
  const [difficulty, setDifficulty] = useState(question.difficulty);

  function cancel() {
    setPrompt(question.prompt);
    setAnswerOutline(question.answer_outline);
    setDifficulty(question.difficulty);
    setEditing(false);
  }

  function save() {
    onSave({ prompt, answer_outline: answerOutline, difficulty });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {question.state !== "generated" && (
          <Badge tone={question.state === "pinned" ? "pinned" : "edited"}>{question.state}</Badge>
        )}
        <Badge tone="neutral">Difficulty {question.difficulty}</Badge>
        {question.requirement_ids.map((id) => (
          <Badge key={id} tone="neutral">
            {requirementText(id)}
          </Badge>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={promptId} className="text-xs font-medium text-slate-500">
              Prompt
            </label>
            <TextArea id={promptId} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={answerId} className="text-xs font-medium text-slate-500">
              Answer outline
            </label>
            <TextArea id={answerId} rows={3} value={answerOutline} onChange={(e) => setAnswerOutline(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-500">Difficulty</label>
            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-auto"
            >
              <option value={1}>1 — entry-level</option>
              <option value={2}>2 — mid</option>
              <option value={3}>3 — senior</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={saving}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-900">{question.prompt}</p>
          {question.answer_outline && <p className="text-sm text-slate-600">{question.answer_outline}</p>}
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Select
            aria-label="Move to category"
            value={question.category}
            onChange={(e) => onCategoryChange(e.target.value as QuestionCategory)}
            className="ml-auto w-auto"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
