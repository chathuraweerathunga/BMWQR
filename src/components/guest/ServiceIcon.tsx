import {
  Bath,
  BedDouble,
  Bell,
  Car,
  Coffee,
  Droplets,
  Dumbbell,
  Flower2,
  Phone,
  Shirt,
  Sparkles,
  Sun,
  UtensilsCrossed,
  Waves,
  Wrench,
  AlarmClock,
  Key,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { ServiceIconKey } from "@/modules/services/icons";

/**
 * Icons a business can pick for a service. The stored value is one of
 * these keys; anything unknown falls back to a guess from the service's
 * name, then to a bell.
 */
export const SERVICE_ICONS: Record<ServiceIconKey, { icon: LucideIcon; label: string }> = {
  towels: { icon: Bath, label: "Towels & bath" },
  housekeeping: { icon: Sparkles, label: "Housekeeping" },
  bed: { icon: BedDouble, label: "Bedding" },
  maintenance: { icon: Wrench, label: "Maintenance" },
  food: { icon: UtensilsCrossed, label: "Food" },
  drinks: { icon: Coffee, label: "Drinks" },
  laundry: { icon: Shirt, label: "Laundry" },
  transport: { icon: Car, label: "Transport" },
  spa: { icon: Flower2, label: "Spa" },
  pool: { icon: Waves, label: "Pool" },
  beach: { icon: Sun, label: "Beach" },
  gym: { icon: Dumbbell, label: "Gym" },
  wakeup: { icon: AlarmClock, label: "Wake-up call" },
  keys: { icon: Key, label: "Keys & access" },
  wifi: { icon: Wifi, label: "Wi-Fi" },
  water: { icon: Droplets, label: "Water" },
  reception: { icon: Phone, label: "Reception" },
  general: { icon: Bell, label: "General" },
};

const KEYWORDS: Array<[RegExp, ServiceIconKey]> = [
  [/towel|bath|toilet/i, "towels"],
  [/clean|housekeep|tidy/i, "housekeeping"],
  [/pillow|bed|blanket|linen/i, "bed"],
  [/repair|maint|fix|leak|broken|ac\b|air ?con/i, "maintenance"],
  [/room service|food|meal|breakfast|dinner|menu/i, "food"],
  [/coffee|tea|drink|bar|minibar/i, "drinks"],
  [/laundry|iron|dry.?clean/i, "laundry"],
  [/taxi|transfer|airport|car|shuttle|transport/i, "transport"],
  [/spa|massage|treatment/i, "spa"],
  [/pool|cabana/i, "pool"],
  [/beach|sun ?bed|umbrella|lounger/i, "beach"],
  [/gym|fitness/i, "gym"],
  [/wake/i, "wakeup"],
  [/key|card|lock/i, "keys"],
  [/wi-?fi|internet/i, "wifi"],
  [/water/i, "water"],
  [/reception|concierge|front desk/i, "reception"],
];

export function serviceIconKey(icon: string | null | undefined, name: string): ServiceIconKey {
  if (icon && icon in SERVICE_ICONS) return icon as ServiceIconKey;
  return KEYWORDS.find(([re]) => re.test(name))?.[1] ?? "general";
}

export function ServiceIcon({
  icon,
  name,
  className,
}: {
  icon: string | null | undefined;
  name: string;
  className?: string;
}) {
  const Icon = SERVICE_ICONS[serviceIconKey(icon, name)].icon;
  return <Icon className={className} aria-hidden />;
}
