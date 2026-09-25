import Link from "next/link";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/app/AuthLayout";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create a workspace" };

function appHostLabel(): string {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000").host;
  } catch {
    return "oneweb.app";
  }
}

export default function SignUpPage() {
  return (
    <AuthLayout>
      <h1 className="text-[28px] font-extrabold tracking-tight">Create your workspace</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        Takes a minute. You&apos;ll add rooms, services and your team next.
      </p>

      <SignupForm appHost={appHostLabel()} />

      <p className="mt-8 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-lagoon-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
