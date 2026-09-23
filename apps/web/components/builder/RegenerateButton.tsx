"use client";

import { Button } from "@/components/ui/Button";
import { useRegenerateSection } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import type { RegeneratableSection } from "@/lib/types";

export function RegenerateButton({ kitId, section, label }: { kitId: string; section: RegeneratableSection; label?: string }) {
  const regenerate = useRegenerateSection(kitId);

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" loading={regenerate.isPending} onClick={() => regenerate.mutate(section)}>
        {label ?? "Regenerate"}
      </Button>
      {regenerate.isError && (
        <span className="text-xs text-red-600">
          {regenerate.error instanceof ApiError ? regenerate.error.message : "Regeneration failed."}
        </span>
      )}
    </div>
  );
}
