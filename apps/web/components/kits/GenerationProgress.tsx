import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { GenerationState, KitStatus } from "@/lib/types";

const STEP_LABEL: Record<string, string> = {
  extract_requirements: "Extracting requirements from the job description",
  crawl_company_site: "Crawling the company site",
  search_public_discussion: "Searching for public discussion of the interview process",
  generate_brief: "Writing the company brief",
  generate_questions: "Generating interview questions",
  check_coverage: "Checking every requirement has a question",
  generate_flashcards: "Generating flashcards",
  build_schedule: "Building the study schedule",
};

function StepIcon({ status }: { status: string }) {
  if (status === "running") return <Spinner size="sm" className="text-slate-500" />;
  if (status === "done") return <span className="text-emerald-600">✓</span>;
  if (status === "failed") return <span className="text-amber-600">!</span>;
  if (status === "skipped") return <span className="text-slate-400">–</span>;
  return <span className="text-slate-300">○</span>;
}

export function GenerationProgress({ status, generation }: { status: KitStatus; generation: GenerationState }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {status === "failed" ? "Kit generation failed" : "Generating your kit…"}
        </h1>
        <p className="text-sm text-slate-500">
          {status === "failed"
            ? "Something went wrong building this kit. See the details below."
            : "This researches the company, extracts requirements, writes questions, and builds a schedule — usually well under a minute."}
        </p>
      </div>

      {status === "failed" && generation.error && (
        <ErrorBanner message={`${generation.error.code}: ${generation.error.message}`} />
      )}

      {generation.steps.length === 0 ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" className="text-slate-400" />
        </div>
      ) : (
        <ol className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          {generation.steps.map((step) => (
            <li key={step.name} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 w-4 shrink-0 text-center">
                <StepIcon status={step.status} />
              </span>
              <div className="flex flex-col">
                <span className={step.status === "pending" ? "text-slate-400" : "text-slate-800"}>
                  {STEP_LABEL[step.name] ?? step.name}
                </span>
                {step.message && <span className="text-xs text-slate-400">{step.message}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
