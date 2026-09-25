import { ButtonLink } from "@/components/ui/Button";

/** Also what a signed-in user sees for a workspace they don't belong to:
 * "doesn't exist" and "not yours" look the same, by design. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-start justify-center gap-4 px-6">
      <p className="font-display text-6xl text-lagoon-800">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight">This page isn&apos;t here</h1>
      <p className="text-[15px] text-ink-soft">
        The address may be mistyped, or you may not have access to this workspace.
      </p>
      <ButtonLink href="/">Go to OneWeb home</ButtonLink>
    </main>
  );
}
