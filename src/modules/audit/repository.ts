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
    },
  });
}

/** For a future "Audit log" screen (`business:view_audit_log`, already in
 * the permission matrix) — not yet wired to a page in this milestone. */
export async function listAuditLogForBusiness(businessId: string, params: { limit?: number } = {}) {
  return prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}
