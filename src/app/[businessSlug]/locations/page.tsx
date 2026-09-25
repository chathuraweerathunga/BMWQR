import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { createLocation, createLocationRange, setLocationStatus } from "@/modules/locations/service";
import { LOCATION_TYPES, type LocationStatus, type LocationType } from "@/modules/locations/types";
import { runAction, textField } from "@/lib/actions";
import { humanizeEnum } from "@/lib/format";
import { ActionForm, type ActionResult } from "@/components/ui/ActionForm";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/Layout";
import { Field, Input, Select } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Locations" };

type Loc = { id: string; name: string; type: string; status: string; parentLocationId: string | null };

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-st-done-bg text-st-done",
  INACTIVE: "bg-st-stopped-bg text-st-stopped",
  MAINTENANCE: "bg-st-progress-bg text-st-progress",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", MAINTENANCE: "Out of service" };

/** Depth-first order with depth, so children sit under their parent. */
function asTree(locations: Loc[]): Array<Loc & { depth: number }> {
  const byParent = new Map<string | null, Loc[]>();
  const ids = new Set(locations.map((l) => l.id));
  for (const l of locations) {
    const key = l.parentLocationId && ids.has(l.parentLocationId) ? l.parentLocationId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  }
  const natural = (a: Loc, b: Loc) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const out: Array<Loc & { depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const l of (byParent.get(parent) ?? []).sort(natural)) {
      out.push({ ...l, depth });
      if (depth < 8) walk(l.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function TypeOptions({ defaultType }: { defaultType: string }) {
  return (
    <Select name="type" required defaultValue={defaultType}>
      {LOCATION_TYPES.map((type) => (
        <option key={type} value={type}>
          {humanizeEnum(type)}
        </option>
      ))}
    </Select>
  );
}

export default async function LocationsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);
  if (!permissionsForActor(actor).has("location:manage")) redirect(`/${businessSlug}/dashboard`);

  const locations = (await listLocationsForBusiness(business.id)) as Loc[];
  const tree = asTree(locations);
  const path = `/${businessSlug}/locations`;
  const parentOptions = tree.filter((l) => l.type !== "ROOM" && l.type !== "TABLE");

  async function createOne(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("locations.create", async () => {
      const location = await createLocation(actor, {
        name: textField(formData, "name") ?? "",
        type: (textField(formData, "type") ?? "") as LocationType,
        parentLocationId: textField(formData, "parentLocationId"),
        description: textField(formData, "description"),
      });
      return `Added ${location.name}.`;
    });
    revalidatePath(path);
    return result;
  }

  async function createRange(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const result = await runAction("locations.range", async () => {
      const { created, skipped } = await createLocationRange(actor, {
        prefix: textField(formData, "prefix") ?? "",
        from: Number(textField(formData, "from")),
        to: Number(textField(formData, "to")),
        type: (textField(formData, "type") ?? "") as LocationType,
        parentLocationId: textField(formData, "parentLocationId"),
      });
      return `Added ${created} location${created === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} that already existed` : ""}.`;
    });
    revalidatePath(path);
    return result;
  }

  async function setStatus(formData: FormData) {
    "use server";
    const locationId = textField(formData, "locationId");
    const status = textField(formData, "status");
    if (!locationId || !status) return;
    await runAction("locations.status", async () => {
      await setLocationStatus(actor, locationId, status as LocationStatus);
    });
    revalidatePath(path);
  }

  const parentSelect = (
    <Select name="parentLocationId" defaultValue="">
      <option value="">Top level</option>
      {parentOptions.map((l) => (
        <option key={l.id} value={l.id}>
          {" ".repeat(l.depth)}
          {l.name}
        </option>
      ))}
    </Select>
  );

  return (
    <>
      <PageHeader
        title="Locations"
        description="Rooms, floors and areas where guests can ask for help. Each can have its own QR code."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Add a range" description="For numbered rooms, tables or units." />
            <ActionForm action={createRange} className="flex flex-col gap-4 p-5">
              <Field label="Name before the number" htmlFor="prefix" optional hint='For example "Room" gives Room 101, Room 102…'>
                <Input id="prefix" name="prefix" defaultValue="Room" maxLength={60} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" htmlFor="from">
                  <Input id="from" name="from" type="number" inputMode="numeric" min={0} required placeholder="101" />
                </Field>
                <Field label="To" htmlFor="to">
                  <Input id="to" name="to" type="number" inputMode="numeric" min={0} required placeholder="150" />
                </Field>
              </div>
              <Field label="Type">
                <TypeOptions defaultType="ROOM" />
              </Field>
              <Field label="Inside">{parentSelect}</Field>
              <SubmitButton pendingLabel="Adding">Add range</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel>
            <PanelHeader title="Add one" description="A building, floor, pool, restaurant…" />
            <ActionForm action={createOne} className="flex flex-col gap-4 p-5">
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" required maxLength={80} placeholder="Pool terrace" />
              </Field>
              <Field label="Type">
                <TypeOptions defaultType="BUILDING" />
              </Field>
              <Field label="Inside">{parentSelect}</Field>
              <Field label="Description" htmlFor="description" optional>
                <Input id="description" name="description" maxLength={200} />
              </Field>
              <SubmitButton pendingLabel="Adding" variant="secondary">
                Add location
              </SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          <PanelHeader title="All locations" description={`${locations.length} in total`} />
          {tree.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<MapPin className="size-6" />} title="No locations yet">
                Start with a building or floor, then add your rooms as a range.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {tree.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1" style={{ paddingLeft: `${l.depth * 20}px` }}>
                    <p className={cn("truncate text-sm", l.depth === 0 ? "font-bold" : "font-semibold")}>
                      {l.depth > 0 && <span className="mr-1.5 text-line-strong" aria-hidden>└</span>}
                      {l.name}
                      <span className="ml-2 text-xs font-normal text-ink-faint">{humanizeEnum(l.type)}</span>
                    </p>
                  </div>
                  <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", STATUS_STYLE[l.status])}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                  <form action={setStatus} className="flex items-center gap-1.5">
                    <input type="hidden" name="locationId" value={l.id} />
                    <label className="sr-only" htmlFor={`st-${l.id}`}>
                      Status for {l.name}
                    </label>
                    <select
                      id={`st-${l.id}`}
                      name="status"
                      defaultValue={l.status}
                      className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-xs"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Out of service</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                      Set
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
