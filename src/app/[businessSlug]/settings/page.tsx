import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { getBusinessById } from "@/modules/business/repository";
import { updateBusinessCore, updateBusinessSettings } from "@/modules/business/service";
import { runAction, textField } from "@/lib/actions";
import { ActionForm, type ActionResult } from "@/components/ui/ActionForm";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BrandingFields } from "./BrandingFields";

export const metadata: Metadata = { title: "Settings" };

const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "INR", "AED", "SGD", "MVR", "THB", "AUD", "JPY", "CNY"];

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "Asia/Colombo"];
  }
}

export default async function BusinessSettingsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business: base, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("business:update_settings")) redirect(`/${businessSlug}/dashboard`);
  const business = await getBusinessById(base.id);
  if (!business) redirect(`/${businessSlug}/dashboard`);
  const settings = business.settings;
  const path = `/${businessSlug}/settings`;
  const zones = timeZones();
  const currencies = CURRENCIES.includes(business.currency) ? CURRENCIES : [business.currency, ...CURRENCIES];

  async function saveProperty(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("settings.property", async () => {
      await updateBusinessCore(actor, {
        name: textField(formData, "name") ?? "",
        timezone: textField(formData, "timezone") ?? undefined,
        currency: textField(formData, "currency") ?? undefined,
      });
      return "Property details saved.";
    });
    revalidatePath(`/${businessSlug}`, "layout");
    return result;
  }

  async function saveBranding(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("settings.branding", async () => {
      await updateBusinessSettings(actor, {
        primaryColor: textField(formData, "primaryColor"),
        logoUrl: textField(formData, "logoUrl"),
        welcomeMessage: textField(formData, "welcomeMessage"),
      });
      return "Guest portal updated.";
    });
    revalidatePath(path);
    return result;
  }

  async function saveContact(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("settings.contact", async () => {
      await updateBusinessSettings(actor, {
        phone: textField(formData, "phone"),
        contactEmail: textField(formData, "contactEmail"),
        website: textField(formData, "website"),
        address: textField(formData, "address"),
        description: textField(formData, "description"),
      });
      return "Contact details saved.";
    });
    revalidatePath(path);
    return result;
  }

  return (
    <>
      <PageHeader title="Settings" description="Your property's details, and how guest services look to guests." />
      <div className="flex max-w-4xl flex-col gap-6">
        <Panel>
          <PanelHeader title="Property" description="Times across OneWeb are shown in this timezone." />
          <ActionForm action={saveProperty} resetOnSuccess={false} className="flex flex-col gap-4 p-5">
            <Field label="Property name" htmlFor="name">
              <Input id="name" name="name" defaultValue={business.name} required maxLength={120} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
              <Field label="Timezone" htmlFor="timezone">
                <Select id="timezone" name="timezone" defaultValue={business.timezone}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" name="currency" defaultValue={business.currency}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <SubmitButton pendingLabel="Saving">Save property</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel>
          <PanelHeader title="Guest portal" description="Make guest services look like your hotel, not like software." />
          <ActionForm action={saveBranding} resetOnSuccess={false} className="flex flex-col gap-4 p-5">
            <BrandingFields
              businessName={business.name}
              primaryColor={settings?.primaryColor ?? null}
              logoUrl={settings?.logoUrl ?? null}
              welcomeMessage={settings?.welcomeMessage ?? null}
            />
            <div>
              <SubmitButton pendingLabel="Saving">Save guest portal</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel>
          <PanelHeader title="Contact" description="Guests see the phone number as a Call reception button." />
          <ActionForm action={saveContact} resetOnSuccess={false} className="flex flex-col gap-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reception phone" htmlFor="phone" optional>
                <Input id="phone" name="phone" type="tel" defaultValue={settings?.phone ?? ""} maxLength={30} />
              </Field>
              <Field label="Contact email" htmlFor="contactEmail" optional>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={settings?.contactEmail ?? ""} maxLength={254} />
              </Field>
            </div>
            <Field label="Website" htmlFor="website" optional>
              <Input id="website" name="website" type="url" defaultValue={settings?.website ?? ""} maxLength={500} placeholder="https://" />
            </Field>
            <Field label="Address" htmlFor="address" optional>
              <Input id="address" name="address" defaultValue={settings?.address ?? ""} maxLength={300} />
            </Field>
            <Field label="About the property" htmlFor="description" optional>
              <Textarea id="description" name="description" rows={3} defaultValue={settings?.description ?? ""} maxLength={1000} />
            </Field>
            <div>
              <SubmitButton pendingLabel="Saving">Save contact details</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
