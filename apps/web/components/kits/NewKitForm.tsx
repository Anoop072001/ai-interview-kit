"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateKit } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function NewKitForm() {
  const jdId = useId();
  const urlId = useId();
  const daysId = useId();
  const router = useRouter();
  const createKit = useCreateKit();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        createKit.mutate(
          { jd, companyUrl, days },
          { onSuccess: (data) => router.push(`/kits/${data.id}`) }
        );
      }}
    >
      {createKit.error && (
        <ErrorBanner
          message={createKit.error instanceof ApiError ? createKit.error.message : "Could not create kit."}
        />
      )}

      <Field label="Job description" htmlFor={jdId}>
        <TextArea
          id={jdId}
          required
          rows={10}
          placeholder="Paste the full job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
      </Field>

      <Field label="Company website" htmlFor={urlId}>
        <TextInput
          id={urlId}
          type="url"
          required
          placeholder="https://example.com"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
        />
      </Field>

      <Field label="Days until interview" htmlFor={daysId}>
        <TextInput
          id={daysId}
          type="number"
          min={1}
          max={60}
          required
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="max-w-[8rem]"
        />
      </Field>

      <Button type="submit" loading={createKit.isPending} className="self-start">
        Generate kit
      </Button>
    </form>
  );
}
