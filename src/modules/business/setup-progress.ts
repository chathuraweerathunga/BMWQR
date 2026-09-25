import { prisma } from "@/lib/prisma";

export interface SetupProgress {
  locations: number;
  services: number;
  qrCodes: number;
  teamMembers: number;
  guestsCheckedIn: number;
}

/**
 * How far a new workspace has got through setup, for the dashboard's
 * getting-started checklist. Plain tenant-scoped counts.
 */
export async function getSetupProgress(businessId: string): Promise<SetupProgress> {
  const [locations, services, qrCodes, teamMembers, guestsCheckedIn] = await Promise.all([
    prisma.location.count({ where: { businessId } }),
    prisma.service.count({ where: { businessId } }),
    prisma.qRCode.count({ where: { businessId } }),
    prisma.businessMembership.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.guestStay.count({ where: { businessId } }),
  ]);
  return { locations, services, qrCodes, teamMembers, guestsCheckedIn };
}
