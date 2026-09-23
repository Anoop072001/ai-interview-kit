"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionForm } from "./AddQuestionForm";
import { RegenerateButton } from "./RegenerateButton";
import {
  useAddQuestion,
  useDeleteQuestion,
  useEditQuestion,
  useReorderQuestions,
} from "@/lib/queries";
import type { Kit, QuestionCategory } from "@/lib/types";

const CATEGORIES: { id: QuestionCategory; label: string }[] = [
  { id: "technical", label: "Technical" },
  { id: "behavioural", label: "Behavioural" },
  { id: "system-design", label: "System design" },
  { id: "company-fit", label: "Company fit" },
];

export function QuestionBank({ kitId, kit }: { kitId: string; kit: Kit }) {
  const nonEmpty = CATEGORIES.filter((c) => kit.questions.some((q) => q.category === c.id));
  const [active, setActive] = useState<QuestionCategory>(nonEmpty[0]?.id ?? "technical");

  const editQuestion = useEditQuestion(kitId);
  const deleteQuestion = useDeleteQuestion(kitId);
  const reorderQuestions = useReorderQuestions(kitId);
  const addQuestion = useAddQuestion(kitId);

  const requirementText = useMemo(() => {
    const byId = new Map(kit.role.requirements.map((r) => [r.id, r.text]));
    return (id: string) => byId.get(id) ?? id;
  }, [kit.role.requirements]);

  const questionsInCategory = kit.questions.filter((q) => q.category === active);

  function move(index: number, direction: -1 | 1) {
    const ids = questionsInCategory.map((q) => q.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderQuestions.mutate({ category: active, orderedIds: ids });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Question bank</h2>
      </div>

      <Tabs
        items={CATEGORIES.map((c) => ({
          id: c.id,
          label: c.label,
          badge: <Badge tone="neutral">{kit.questions.filter((q) => q.category === c.id).length}</Badge>,
        }))}
        activeId={active}
        onChange={(id) => setActive(id as QuestionCategory)}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {questionsInCategory.length} question{questionsInCategory.length === 1 ? "" : "s"} in this category
        </p>
        <RegenerateButton kitId={kitId} section={active} label="Regenerate this category" />
      </div>

      {questionsInCategory.length === 0 ? (
        <EmptyState title="No questions in this category yet" description="Add one by hand, or regenerate to try again." />
      ) : (
        <div className="flex flex-col gap-3">
          {questionsInCategory.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              requirementText={requirementText}
              canMoveUp={index > 0}
              canMoveDown={index < questionsInCategory.length - 1}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onSave={(patch) => editQuestion.mutate({ id: question.id, patch })}
              onDelete={() => deleteQuestion.mutate(question.id)}
              onCategoryChange={(category) => editQuestion.mutate({ id: question.id, patch: { category } })}
              saving={editQuestion.isPending && editQuestion.variables?.id === question.id}
            />
          ))}
        </div>
      )}

      <AddQuestionForm
        category={active}
        requirements={kit.role.requirements}
        onAdd={(input) => addQuestion.mutate(input)}
        adding={addQuestion.isPending}
      />
    </section>
  );
}
