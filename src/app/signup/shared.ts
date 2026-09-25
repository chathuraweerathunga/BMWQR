import type { CreateBusinessInput } from "@/modules/business/repository";

export interface SignupState {
  error?: string;
  /** What the visitor typed (never the password), so a failed attempt
   * doesn't wipe the form: React resets a form after its action runs. */
  values?: Partial<Record<"businessName" | "businessSlug" | "businessType" | "ownerName" | "ownerEmail", string>>;
}

export const BUSINESS_TYPES: Array<{ value: CreateBusinessInput["type"]; label: string }> = [
  { value: "HOTEL", label: "Hotel" },
  { value: "RESORT", label: "Resort" },
  { value: "GUESTHOUSE", label: "Guesthouse" },
  { value: "VILLA", label: "Villa" },
  { value: "APARTMENT", label: "Serviced apartments" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "CAFE", label: "Café" },
  { value: "SPA", label: "Spa" },
  { value: "SALON", label: "Salon" },
  { value: "GYM", label: "Gym" },
  { value: "COWORKING", label: "Coworking space" },
  { value: "OFFICE", label: "Office" },
  { value: "EVENT_VENUE", label: "Event venue" },
  { value: "OTHER", label: "Something else" },
];

export const BUSINESS_TYPE_VALUES: ReadonlySet<string> = new Set(BUSINESS_TYPES.map((t) => t.value));
