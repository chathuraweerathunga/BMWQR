export type AuditActorType = "user" | "guest" | "system" | "platform";

export interface AuditEntry {
  businessId?: string | null;
  actorUserId?: string | null;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
