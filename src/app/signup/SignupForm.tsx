"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signupAction } from "./actions";
import { BUSINESS_TYPES, type SignupState } from "./shared";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * The signup form. Suggests a workspace address from the property name
 * until the owner edits it, and sends the browser's timezone so times show
 * correctly from the first request. Everything is re-validated server-side.
 */
/** Property name + workspace address, kept in step until the owner edits
 * the address. Remounted (via key) after a failed attempt so it starts
 * from what was typed. */
function IdentityFields({ appHost, initial }: { appHost: string; initial: SignupState["values"] }) {
  const [name, setName] = useState(initial?.businessName ?? "");
  const [slug, setSlug] = useState(initial?.businessSlug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.businessSlug));

  return (
    <>
      <Field label="Property name" htmlFor="businessName">
        <Input
          id="businessName"
          name="businessName"
          required
          maxLength={120}
          autoComplete="organization"
          placeholder="Ocean Pearl Resort"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>

      <Field
        label="Workspace address"
        htmlFor="businessSlug"
        hint="Lowercase letters, numbers and hyphens. Your team signs in here."
      >
        <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-control)] border border-line-strong bg-surface focus-within:border-lagoon-600 focus-within:ring-3 focus-within:ring-lagoon-100">
          <span className="max-w-[45%] shrink-0 truncate border-r border-line bg-sunken px-3 text-sm leading-[44px] text-ink-faint">
            {appHost}/
          </span>
          <input
            id="businessSlug"
            name="businessSlug"
            required
            minLength={3}
            maxLength={48}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase letters, numbers and hyphens only"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] focus:outline-none"
            placeholder="ocean-pearl-resort"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
      </Field>
    </>
  );
}

/**
 * The signup form. Sends the browser's timezone so times show correctly
 * from the first request. Everything is re-validated server-side.
 */
export function SignupForm({ appHost }: { appHost: string }) {
  const [state, formAction] = useActionState<SignupState, FormData>(signupAction, {});
  const values = state.values ?? {};
  const tzRef = useRef<HTMLInputElement>(null);

  // Writing to the DOM, not React state: the server can't know the
  // visitor's timezone, so it's filled in once the page is in the browser.
  useEffect(() => {
    try {
      if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      // keep UTC
    }
  });

  return (
    <>
      {state.error && (
        <Alert tone="error" className="mt-6">
          {state.error}
        </Alert>
      )}

      <form action={formAction} className="mt-8 flex flex-col gap-5">
        <IdentityFields key={JSON.stringify(state.values ?? {})} appHost={appHost} initial={state.values} />
        <Field label="Type of business" htmlFor="businessType">
          <Select
            id="businessType"
            name="businessType"
            required
            key={`type-${values.businessType ?? "HOTEL"}`}
            defaultValue={values.businessType ?? "HOTEL"}
          >
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="my-1 border-t border-line" />

        <Field label="Your name" htmlFor="ownerName">
          <Input
            id="ownerName"
            name="ownerName"
            required
            maxLength={120}
            autoComplete="name"
            key={`name-${values.ownerName ?? ""}`}
            defaultValue={values.ownerName}
          />
        </Field>
        <Field label="Work email" htmlFor="ownerEmail">
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            key={`email-${values.ownerEmail ?? ""}`}
            defaultValue={values.ownerEmail}
          />
        </Field>
        <Field label="Password" htmlFor="ownerPassword" hint="At least 8 characters.">
          <Input
            id="ownerPassword"
            name="ownerPassword"
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
          />
        </Field>

        <input ref={tzRef} type="hidden" name="timezone" defaultValue="UTC" />

        <SubmitButton size="lg" block pendingLabel="Creating workspace">
          Create workspace
        </SubmitButton>
      </form>
    </>
  );
}
