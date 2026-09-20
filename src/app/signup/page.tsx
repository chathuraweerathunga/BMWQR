import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { signUpBusiness } from "@/modules/business/service";
import { ValidationError } from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { CreateBusinessInput } from "@/modules/business/repository";

const BUSINESS_TYPES: CreateBusinessInput["type"][] = [
  "HOTEL",
  "RESORT",
  "GUESTHOUSE",
  "VILLA",
  "RESTAURANT",
  "CAFE",
  "SALON",
  "SPA",
  "GYM",
  "COWORKING",
  "OFFICE",
  "APARTMENT",
  "EVENT_VENUE",
  "OTHER",
];

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60_000;

/**
 * Public business signup (project instructions section 8, Step 1). A brand
 * new, unauthenticated visitor lands here — never confuse this with staff
 * invites, which grant access to an EXISTING business and belong in the
 * staff module (spec section 14: staff:invite) once that UI exists.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function signup(formData: FormData) {
    "use server";

    const ip = getClientIp(await headers());
    const limitResult = rateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
    if (!limitResult.allowed) {
      redirect("/signup?error=RATE_LIMITED");
    }

    const businessName = formData.get("businessName");
    const businessSlug = formData.get("businessSlug");
    const businessType = formData.get("businessType");
    const ownerName = formData.get("ownerName");
    const ownerEmail = formData.get("ownerEmail");
    const ownerPassword = formData.get("ownerPassword");

    if (
      typeof businessName !== "string" ||
      typeof businessSlug !== "string" ||
      typeof businessType !== "string" ||
      typeof ownerName !== "string" ||
      typeof ownerEmail !== "string" ||
      typeof ownerPassword !== "string"
    ) {
      redirect("/signup?error=INVALID_INPUT");
    }

    let slug: string;
    try {
      const { business } = await signUpBusiness({
        businessName,
        businessSlug,
        businessType: businessType as CreateBusinessInput["type"],
        ownerName,
        ownerEmail,
        ownerPassword,
      });
      slug = business.slug;
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/signup?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }

    try {
      await signIn("credentials", {
        email: ownerEmail,
        password: ownerPassword,
        redirectTo: `/${slug}/dashboard`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        // The account was created successfully even if the automatic
        // sign-in step failed for some reason — send them to sign in
        // manually rather than losing the "you're all set" moment.
        redirect(`/login?next=/${slug}/dashboard`);
      }
      throw err;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Create your OneWeb workspace</h1>
        <p className="text-sm text-gray-500">
          Set up your business — you can invite staff and configure everything else afterward.
        </p>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "RATE_LIMITED"
            ? "Too many attempts — please wait a while and try again."
            : error === "INVALID_INPUT"
              ? "Please fill in every field."
              : decodeURIComponent(error)}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-500">Business</legend>
          <input
            name="businessName"
            placeholder="Business name (e.g. Ocean Pearl Resort)"
            required
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="businessSlug"
            placeholder="Workspace URL (e.g. ocean-pearl-resort)"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase letters, numbers and hyphens only"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select name="businessType" required className="rounded border border-gray-300 px-3 py-2 text-sm">
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-500">Your account</legend>
          <input
            name="ownerName"
            placeholder="Your name"
            required
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="ownerEmail"
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="ownerPassword"
            type="password"
            placeholder="Password (min. 8 characters)"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </fieldset>

        <button type="submit" className="rounded bg-black px-3 py-2 text-sm font-medium text-white">
          Create workspace
        </button>
      </form>
    </main>
  );
}
