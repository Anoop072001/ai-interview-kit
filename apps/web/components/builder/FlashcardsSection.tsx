"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FlashcardCard } from "./FlashcardCard";
import { AddFlashcardForm } from "./AddFlashcardForm";
import { RegenerateButton } from "./RegenerateButton";
import { useAddFlashcard, useDeleteFlashcard, useEditFlashcard } from "@/lib/queries";
import type { Kit } from "@/lib/types";

export function FlashcardsSection({ kitId, kit }: { kitId: string; kit: Kit }) {
  const editFlashcard = useEditFlashcard(kitId);
  const deleteFlashcard = useDeleteFlashcard(kitId);
  const addFlashcard = useAddFlashcard(kitId);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Flashcards</h2>
        <div className="flex items-center gap-2">
          {kit.flashcards.length > 0 && (
            <Link href={`/kits/${kitId}/practice`}>
              <Button size="sm">Practice</Button>
            </Link>
          )}
          <RegenerateButton kitId={kitId} section="flashcards" />
        </div>
      </div>

      {kit.flashcards.length === 0 ? (
        <EmptyState title="No flashcards yet" description="Add one by hand, or regenerate to try again." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kit.flashcards.map((flashcard) => (
            <FlashcardCard
              key={flashcard.id}
              flashcard={flashcard}
              onSave={(patch) => editFlashcard.mutate({ id: flashcard.id, patch })}
              onDelete={() => deleteFlashcard.mutate(flashcard.id)}
              saving={editFlashcard.isPending && editFlashcard.variables?.id === flashcard.id}
            />
          ))}
        </div>
      )}

      <AddFlashcardForm requirements={kit.role.requirements} onAdd={(input) => addFlashcard.mutate(input)} adding={addFlashcard.isPending} />
    </section>
  );
}
