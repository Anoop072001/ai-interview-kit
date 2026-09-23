"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  submitting,
  errorMessage,
  footer,
}: {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => void;
  submitting: boolean;
  errorMessage: string | null;
  footer: React.ReactNode;
}) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, password);
      }}
    >
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

      {errorMessage && <ErrorBanner message={errorMessage} />}

      <Field label="Email" htmlFor={emailId}>
        <TextInput
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor={passwordId}>
        <TextInput
          id={passwordId}
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitLabel}
      </Button>

      {footer}
    </form>
  );
}
