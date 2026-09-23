"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { RegenerateButton } from "./RegenerateButton";
import { useEditCompanyBrief } from "@/lib/queries";
import type { Kit } from "@/lib/types";

export function CompanyBriefSection({ kitId, kit }: { kitId: string; kit: Kit }) {
  const summaryId = useId();
  const whatId = useId();
  const editBrief = useEditCompanyBrief(kitId);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(kit.company_brief.summary);
  const [whatTheyDo, setWhatTheyDo] = useState(kit.company_brief.what_they_do);

  function cancel() {
    setSummary(kit.company_brief.summary);
    setWhatTheyDo(kit.company_brief.what_they_do);
    setEditing(false);
  }

  function save() {
    editBrief.mutate({ summary, what_they_do: whatTheyDo });
    setEditing(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{kit.source.company || kit.source.company_url}</h2>
          <p className="text-sm text-slate-500">{kit.source.role}</p>
        </div>
        <RegenerateButton kitId={kitId} section="company_brief" />
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={summaryId} className="text-xs font-medium text-slate-500">
              Summary
            </label>
            <TextArea id={summaryId} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={whatId} className="text-xs font-medium text-slate-500">
              What they do
            </label>
            <TextArea id={whatId} rows={2} value={whatTheyDo} onChange={(e) => setWhatTheyDo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={editBrief.isPending}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-800">{kit.company_brief.summary}</p>
          {kit.company_brief.what_they_do && <p className="text-sm text-slate-600">{kit.company_brief.what_they_do}</p>}
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} className="self-start">
            Edit
          </Button>
        </div>
      )}

      {kit.company_brief.sources.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer select-none">{kit.company_brief.sources.length} source(s)</summary>
          <ul className="mt-1 flex flex-col gap-0.5 pl-4">
            {kit.company_brief.sources.map((s) => (
              <li key={s} className="truncate">
                <a href={s} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-slate-600">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
