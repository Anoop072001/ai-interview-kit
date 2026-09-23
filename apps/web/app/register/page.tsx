"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegister } from "@/lib/queries";
import { AuthForm } from "@/components/auth/AuthForm";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const register = useRegister();
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <AuthForm
        title="Create an account"
        submitLabel="Register"
        submitting={register.isPending}
        errorMessage={register.error instanceof ApiError ? register.error.message : null}
        onSubmit={(email, password) =>
          register.mutate({ email, password }, { onSuccess: () => router.replace("/kits") })
        }
        footer={
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">
              Log in
            </Link>
          </p>
        }
      />
    </div>
  );
}
