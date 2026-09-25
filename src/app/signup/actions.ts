"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { signUpBusiness } from "@/modules/business/service";
import { ValidationError } from "@/lib/errors";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { CreateBusinessInput } from "@/modules/business/repository";
import { BUSINESS_TYPE_VALUES, type SignupState } from "./shared";

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60_000;

/**
 * Public business signup (project instructions section 8, step 1): creates
 * the Business, the owner's User and their BUSINESS_OWNER membership, then
 * signs the owner straight in. Errors come back as action state, never via
 * the URL, so a crafted link can't put arbitrary text on this page.
 */
export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const ip = getClientIp(await headers());
  const limitResult = await rateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!limitResult.allowed) {
    return { error: "Too many sign-up attempts from this network. Wait an hour and try again." };
  }

  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const input = {
    businessName: field("businessName"),
    businessSlug: field("businessSlug"),
    businessType: field("businessType"),
    ownerName: field("ownerName"),
    ownerEmail: field("ownerEmail"),
    ownerPassword: field("ownerPassword"),
    timezone: field("timezone"),
  };

  const values = {
    businessName: input.businessName,
    businessSlug: input.businessSlug,
    businessType: input.businessType,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
  };

  if (!input.businessName || !input.businessSlug || !input.ownerName || !input.ownerEmail || !input.ownerPassword) {
    return { error: "Fill in every field to continue.", values };
  }
  if (!BUSINESS_TYPE_VALUES.has(input.businessType as CreateBusinessInput["type"])) {
    return { error: "Choose the type of business.", values };
  }

  let slug: string;
  try {
    const { business } = await signUpBusiness({
      ...input,
      businessType: input.businessType as CreateBusinessInput["type"],
    });
    slug = business.slug;
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message, values };
    // Never show internal errors to the visitor (section 46): log the
    // detail server-side, show a plain message.
    console.error("[signup] unexpected failure", err);
    return { error: "The workspace couldn't be created. Try again in a moment.", values };
  }

  try {
    await signIn("credentials", {
      email: input.ownerEmail,
      password: input.ownerPassword,
      redirectTo: `/${slug}/dashboard?welcome=1`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // The workspace exists; only the automatic sign-in failed.
      redirect(`/login?next=${encodeURIComponent(`/${slug}/dashboard`)}`);
    }
    throw err; // includes Next.js's own redirect signal on success
  }
  return {};
}
