import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { safeRedirectPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Staff sign-in. Wrong email and wrong password get the same message, and
 * a rate-limited attempt looks identical too, so the form reveals nothing
 * about which accounts exist.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const redirectTo = safeRedirectPath(next);

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const nextParam = redirectTo !== "/" ? `&next=${encodeURIComponent(redirectTo)}` : "";
        redirect(`/login?error=credentials${nextParam}`);
      }
      throw err;
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[28px] font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">For your team: front desk, housekeeping, managers.</p>

      {error && (
        <Alert tone="error" className="mt-6">
          That email and password don&apos;t match an account. Check both and try again.
        </Alert>
      )}

      <form action={login} className="mt-8 flex flex-col gap-5">
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" autoFocus maxLength={254} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            maxLength={200}
          />
        </Field>
        <SubmitButton size="lg" block pendingLabel="Signing in">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-8 text-sm text-ink-soft">
        Setting up a new property?{" "}
        <Link href="/signup" className="font-semibold text-lagoon-700 underline-offset-4 hover:underline">
          Create a workspace
        </Link>
      </p>
      <p className="mt-3 text-sm text-ink-faint">
        Guests don&apos;t need an account. Reception gives you a link at check-in.
      </p>
    </AuthLayout>
  );
}
