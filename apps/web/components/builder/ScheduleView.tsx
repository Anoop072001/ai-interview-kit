import { RegenerateButton } from "./RegenerateButton";
import type { Kit } from "@/lib/types";

export function ScheduleView({ kitId, kit }: { kitId: string; kit: Kit }) {
  const questionById = new Map(kit.questions.map((q) => [q.id, q]));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Study schedule — {kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"}
        </h2>
        <RegenerateButton kitId={kitId} section="schedule" />
      </div>

      {kit.coverage.uncovered_requirement_ids.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {kit.coverage.uncovered_requirement_ids.length} requirement(s) still have no question after{" "}
          {kit.coverage.passes} coverage pass(es).
        </p>
      )}

      <div className="flex flex-col gap-3">
        {kit.schedule.days.map((day) => (
          <div key={day.day} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                Day {day.day} — {day.focus}
              </p>
              <span className="text-xs text-slate-400">{day.minutes} min</span>
            </div>
            {day.question_ids.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
                {day.question_ids.map((id) => (
                  <li key={id} className="truncate">
                    · {questionById.get(id)?.prompt ?? id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
