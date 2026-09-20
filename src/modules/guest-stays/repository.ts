import { prisma, type PrismaTransactionClient } from "@/lib/prisma";

export interface CheckInInput {
  businessId: string;
  guestId: string;
  locationId?: string | null;
  checkOutAt: Date;
  createdByUserId?: string | null;
}

/** Creates a new ACTIVE GuestStay. Checking a guest in does not by itself
 * create a session — that happens when the guest actually opens the
 * portal or scans a QR (see guest-sessions/repository.ts). */
export async function checkIn(input: CheckInInput) {
  return prisma.guestStay.create({
    data: {
      businessId: input.businessId,
      guestId: input.guestId,
      locationId: input.locationId ?? null,
      checkOutAt: input.checkOutAt,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export async function getActiveStayById(businessId: string, guestStayId: string) {
  return prisma.guestStay.findFirst({
    where: { id: guestStayId, businessId, status: "ACTIVE" },
  });
}

export async function getStayById(businessId: string, guestStayId: string) {
  return prisma.guestStay.findFirst({ where: { id: guestStayId, businessId } });
}

/** For the reception "who's currently checked in" screen. */
export async function listActiveStaysForBusiness(businessId: string) {
  return prisma.guestStay.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { guest: true, location: true },
    orderBy: { checkOutAt: "asc" },
  });
}

/**
 * Checks a guest out: flips the stay to EXPIRED and revokes every session
 * tied to it, in one transaction, so there is no window where the stay is
 * closed but a session is still usable (or vice versa). Historical
 * requests/feedback on the stay are untouched (project instructions
 * section 4: "Do not simply delete the guest record").
 */
export async function checkOut(businessId: string, guestStayId: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const result = await tx.guestStay.updateMany({
      where: { id: guestStayId, businessId, status: "ACTIVE" },
      data: { status: "EXPIRED", actualCheckOutAt: now },
    });
    if (result.count === 0) {
      return { checkedOut: false as const };
    }
    await tx.guestSession.updateMany({
      where: { guestStayId, businessId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { checkedOut: true as const };
  });
}

/**
 * Sweep job for a scheduled/background worker (a `SystemActor`, per
 * project instructions section 33: "Background workers must also carry
 * tenant context safely"). Finds every stay across ALL businesses whose
 * checkout time has passed but is still marked ACTIVE (e.g. the guest
 * simply left without a reception checkout), and expires it + revokes its
 * sessions. Safe to run tenant-agnostic because each row is updated using
 * its own businessId — no data ever moves between tenants.
 */
export async function expireOverdueStays(now: Date = new Date()) {
  const overdue = await prisma.guestStay.findMany({
    where: { status: "ACTIVE", checkOutAt: { lte: now } },
    select: { id: true, businessId: true },
  });

  for (const stay of overdue) {
    await checkOut(stay.businessId, stay.id, now);
  }

  return { expiredCount: overdue.length };
}
