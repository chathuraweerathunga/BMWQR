import { assertAuthorized } from "@/modules/auth/authorize";
import type { Actor, StaffActor } from "@/modules/auth/types";
import { listAuditLogForBusiness, recordAuditEntry } from "./repository";
import type { AuditActorType } from "./types";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/rate-limit";

/** IP and browser of the request being audited, when there is one (a
 * server action or route handler). Background jobs have no request. */
async function requestMetadata(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = getClientIp(h);
    return { ipAddress: ip === "unknown" ? null : ip.slice(0, 64), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

export interface LogAuditParams {
  /** Defaults to `actor`'s own businessId when the actor carries one
   * (staff/guest/system) — pass explicitly only for a PlatformActor acting
   * on a specific tenant (and see modules/auth/types.ts: that override MUST
   * be paired with exactly this kind of audit entry). */
  businessId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

function actorTypeFor(actor: Actor): AuditActorType {
  switch (actor.kind) {
    case "staff":
      return "user";
    case "guest":
      return "guest";
    case "system":
      return "system";
    case "platform":
      return "platform";
  }
}

function actorUserIdFor(actor: Actor): string | null {
  if (actor.kind === "staff" || actor.kind === "platform") return actor.userId;
  return null;
}

function businessIdFor(actor: Actor): string | null {
  if (actor.kind === "staff" || actor.kind === "guest" || actor.kind === "system") {
    return actor.businessId;
  }
  return null;
}

/**
 * Records one audit entry (project instructions section 34). Deliberately
 * best-effort: a failure here is logged to the server console and
 * swallowed rather than thrown, so audit logging can never take down the
 * operation it's describing — the operation itself has already succeeded
 * by the time callers reach this.
 */
export async function logAudit(actor: Actor, params: LogAuditParams): Promise<void> {
  try {
    const meta = await requestMetadata();
    await recordAuditEntry({
      ...meta,
      businessId: params.businessId !== undefined ? params.businessId : businessIdFor(actor),
      actorType: actorTypeFor(actor),
      actorUserId: actorUserIdFor(actor),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to record entry", {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      err,
    });
  }
}

/** Staff-facing audit-log listing (`business:view_audit_log` — the
 * permission has existed in the matrix since Milestone 1; this is its
 * first caller). BUSINESS_OWNER or MANAGER only. */
export async function getAuditLogForBusiness(
  actor: StaffActor,
  params: { limit?: number; before?: Date; actionPrefix?: string } = {},
) {
  assertAuthorized({
    actor,
    action: "business:view_audit_log",
    resource: { businessId: actor.businessId },
  });
  return listAuditLogForBusiness(actor.businessId, params);
}
