import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditEntry } from "./types";

export async function recordAuditEntry(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      businessId: entry.businessId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      oldValue: (entry.oldValue as Prisma.InputJsonValue | null | undefined) ?? undefined,
      newValue: (entry.newValue as Prisma.InputJsonValue | null | undefined) ?? undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/** Newest first, with the acting user's name. `before` pages backwards. */
export async function listAuditLogForBusiness(
  businessId: string,
  params: { limit?: number; before?: Date; actionPrefix?: string } = {},
) {
  return prisma.auditLog.findMany({
    where: {
      businessId,
      ...(params.before ? { createdAt: { lt: params.before } } : {}),
      ...(params.actionPrefix ? { action: { startsWith: params.actionPrefix } } : {}),
    },
    include: { actorUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}
