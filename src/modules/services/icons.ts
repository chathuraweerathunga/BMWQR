/** Icon keys a service can use in the guest portal. The UI maps each key to
 * an icon (components/guest/ServiceIcon.tsx); the service layer only
 * validates that a stored key is one of these. */
export const SERVICE_ICON_KEYS = [
  "towels", "housekeeping", "bed", "maintenance", "food", "drinks", "laundry", "transport", "spa",
  "pool", "beach", "gym", "wakeup", "keys", "wifi", "water", "reception", "general",
] as const;

export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number];
