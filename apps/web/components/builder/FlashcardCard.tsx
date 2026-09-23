"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import type { Flashcard } from "@/lib/types";

export function FlashcardCard({
  flashcard,
  onSave,
  onDelete,
  saving,
}: {
  flashcard: Flashcard;
  onSave: (patch: Partial<Flashcard>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const frontId = useId();
  const backId = useId();
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);

  function cancel() {
    setFront(flashcard.front);
    setBack(flashcard.back);
    setEditing(false);
  }

  function save() {
    onSave({ front, back });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      {flashcard.state !== "generated" && (
        <Badge tone={flashcard.state === "pinned" ? "pinned" : "edited"}>{flashcard.state}</Badge>
      )}

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={frontId} className="text-xs font-medium text-slate-500">
              Front
            </label>
            <TextArea id={frontId} rows={2} value={front} onChange={(e) => setFront(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={backId} className="text-xs font-medium text-slate-500">
              Back
            </label>
            <TextArea id={backId} rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
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
          <p className="text-sm font-medium text-slate-900">{flashcard.front}</p>
          <p className="text-sm text-slate-600">{flashcard.back}</p>
        </div>
      )}

      {!editing && (
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
