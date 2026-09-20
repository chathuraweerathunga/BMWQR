import { prisma } from "@/lib/prisma";

export interface CreateGuestInput {
  businessId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export async function createGuest(input: CreateGuestInput) {
  return prisma.guest.create({
    data: {
      businessId: input.businessId,
      fullName: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function getGuestById(businessId: string, guestId: string) {
  return prisma.guest.findFirst({ where: { id: guestId, businessId } });
}
