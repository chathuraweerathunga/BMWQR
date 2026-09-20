import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Minimal staff sign-in page — deliberately unstyled beyond basic Tailwind
 * spacing. The real staff UI (branding, layout, dashboard shell) is a
 * later milestone; this exists now so the auth flow is end-to-end
 * testable once a database is available.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Only ever a same-site relative path — never an absolute/external URL —
  // so a crafted `next` value can't turn this into an open redirect.
  const redirectTo = next && next.startsWith("/") ? next : "/";

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
        redirect(`/login?error=${err.type}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
      }
      throw err;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Staff sign in</h1>
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          Incorrect email or password.
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>
      <p className="text-center text-sm text-gray-500">
        New business?{" "}
        <Link href="/signup" className="underline">
          Create a workspace
        </Link>
      </p>
    </main>
  );
}
