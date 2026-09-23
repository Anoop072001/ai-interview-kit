"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLogin } from "@/lib/queries";
import { AuthForm } from "@/components/auth/AuthForm";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const login = useLogin();
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <AuthForm
        title="Log in"
        submitLabel="Log in"
        submitting={login.isPending}
        errorMessage={login.error instanceof ApiError ? login.error.message : null}
        onSubmit={(email, password) =>
          login.mutate({ email, password }, { onSuccess: () => router.replace("/kits") })
        }
        footer={
          <p className="text-sm text-slate-500">
            No account?{" "}
            <Link href="/register" className="font-medium text-slate-900 underline underline-offset-2">
              Register
            </Link>
          </p>
        }
      />
    </div>
  );
}
