import { Badge } from "@/components/ui/Badge";
import type { Kit } from "@/lib/types";

export function RoleSection({ kit }: { kit: Kit }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Role breakdown</h2>
        <span className="text-sm text-slate-500">{kit.role.seniority}</span>
      </div>

      {kit.role.responsibilities.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-medium text-slate-700">Responsibilities</h3>
          <ul className="list-inside list-disc text-sm text-slate-600">
            {kit.role.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1.5 text-sm font-medium text-slate-700">Requirements</h3>
        {kit.role.requirements.length === 0 ? (
          <p className="text-sm text-slate-400">No requirements were extracted from this description.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {kit.role.requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                <Badge tone={r.priority === "must" ? "must" : "nice"}>{r.priority}</Badge>
                <Badge tone="neutral">{r.kind}</Badge>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
