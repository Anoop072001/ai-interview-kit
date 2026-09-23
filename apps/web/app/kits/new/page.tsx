"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { NewKitForm } from "@/components/kits/NewKitForm";
import { BulkUploadForm } from "@/components/kits/BulkUploadForm";

type Mode = "single" | "bulk";

function NewKitPageContent() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Create a prep kit</h1>

      <div role="tablist" aria-label="Kit creation mode" className="flex gap-1 rounded-lg bg-slate-100 p-1 self-start">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {m === "single" ? "Paste one role" : "Upload multiple roles"}
          </button>
        ))}
      </div>

      {mode === "single" ? <NewKitForm /> : <BulkUploadForm />}
    </div>
  );
}

export default function NewKitPage() {
  return (
    <AuthGuard>
      <NewKitPageContent />
    </AuthGuard>
  );
}
