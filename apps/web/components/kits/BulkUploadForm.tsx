"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useBulkCreateKits } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Badge } from "@/components/ui/Badge";
import type { BulkCaseInput } from "@/lib/types";

interface ParsedCase {
  case: BulkCaseInput;
  problems: string[];
}

function parseFile(text: string): { cases: ParsedCase[]; fileError: string | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { cases: [], fileError: "That file isn't valid JSON." };
  }
  if (!Array.isArray(raw)) {
    return { cases: [], fileError: "Expected a JSON array of { jd, company_url, days } objects." };
  }

  const cases: ParsedCase[] = raw.map((entry) => {
    const problems: string[] = [];
    const e = entry as Partial<BulkCaseInput>;
    if (typeof e.jd !== "string" || e.jd.trim().length === 0) problems.push("missing jd");
    if (typeof e.company_url !== "string" || e.company_url.trim().length === 0) problems.push("missing company_url");
    if (typeof e.days !== "number" || !Number.isInteger(e.days) || e.days < 1 || e.days > 60) {
      problems.push("days must be an integer between 1 and 60");
    }
    return { case: { jd: e.jd ?? "", company_url: e.company_url ?? "", days: e.days ?? 0 }, problems };
  });

  return { cases, fileError: cases.length === 0 ? "The file has no entries." : null };
}

export function BulkUploadForm() {
  const inputId = useId();
  const router = useRouter();
  const bulkCreate = useBulkCreateKits();
  const [parsed, setParsed] = useState<ParsedCase[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const validCount = parsed.filter((p) => p.problems.length === 0).length;

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const result = parseFile(text);
    setParsed(result.cases);
    setFileError(result.fileError);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          Upload a JSON file of roles
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        <p className="text-xs text-slate-400">
          A JSON array of objects: <code>{`{ "jd": "...", "company_url": "https://...", "days": 5 }`}</code>
        </p>
      </div>

      {fileError && <ErrorBanner message={fileError} />}

      {parsed.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 divide-y divide-slate-100">
          {parsed.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate text-slate-700">
                {p.case.company_url || "(no URL)"} — {p.case.jd.slice(0, 40) || "(no description)"}
                {p.case.jd.length > 40 ? "…" : ""}
              </span>
              {p.problems.length === 0 ? (
                <Badge tone="success">Valid</Badge>
              ) : (
                <Badge tone="danger">{p.problems.join(", ")}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {bulkCreate.error && (
        <ErrorBanner
          message={bulkCreate.error instanceof ApiError ? bulkCreate.error.message : "Could not submit the batch."}
        />
      )}

      <Button
        disabled={validCount === 0}
        loading={bulkCreate.isPending}
        onClick={() =>
          bulkCreate.mutate(
            parsed.filter((p) => p.problems.length === 0).map((p) => p.case),
            { onSuccess: () => router.push("/kits") }
          )
        }
        className="self-start"
      >
        {fileName ? `Create ${validCount} kit${validCount === 1 ? "" : "s"}` : "Create kits"}
      </Button>
    </div>
  );
}
