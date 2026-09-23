"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, TextArea } from "@/components/ui/Field";
import type { Requirement } from "@/lib/types";

export function AddFlashcardForm({
  requirements,
  onAdd,
  adding,
}: {
  requirements: Requirement[];
  onAdd: (input: { front: string; back: string; requirement_ids: string[] }) => void;
  adding: boolean;
}) {
  const frontId = useId();
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start">
        + Add a flashcard
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!front.trim() || !back.trim()) return;
        onAdd({ front, back, requirement_ids: requirementId ? [requirementId] : [] });
        setFront("");
        setBack("");
        setOpen(false);
      }}
    >
      <label htmlFor={frontId} className="text-xs font-medium text-slate-500">
        Front
      </label>
      <TextArea id={frontId} required rows={2} value={front} onChange={(e) => setFront(e.target.value)} />

      <label className="text-xs font-medium text-slate-500">Back</label>
      <TextArea required rows={2} value={back} onChange={(e) => setBack(e.target.value)} />

      {requirements.length > 0 && (
        <>
          <label className="text-xs font-medium text-slate-500">Related requirement (optional)</label>
          <Select value={requirementId} onChange={(e) => setRequirementId(e.target.value)} className="w-auto">
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.text}
              </option>
            ))}
          </Select>
        </>
      )}

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
