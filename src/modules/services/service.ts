import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/modules/audit/service";
import { getDepartmentById } from "@/modules/departments/repository";
import * as repo from "./repository";
import type { CreateServiceInput, UpdateServiceInput } from "./repository";
import { SERVICE_ICON_KEYS } from "./icons";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

/** Shared checks for create and update. Returns the cleaned values. */
async function validateServiceFields(businessId: string, input: UpdateServiceInput): Promise<UpdateServiceInput> {
  const out: UpdateServiceInput = { ...input };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ValidationError("Service name is required.");
    if (name.length > 80) throw new ValidationError("Keep the service name under 80 characters.");
    out.name = name;
  }
  if (input.description && input.description.length > 300) {
    throw new ValidationError("Keep the description under 300 characters.");
  }
  if (input.icon && !(SERVICE_ICON_KEYS as readonly string[]).includes(input.icon)) {
    throw new ValidationError("Choose an icon from the list.");
  }
  if (input.defaultPriority && !(PRIORITIES as readonly string[]).includes(input.defaultPriority)) {
    throw new ValidationError("Choose a priority.");
  }
  if (input.estimatedMinutes !== undefined && input.estimatedMinutes !== null) {
    if (!Number.isInteger(input.estimatedMinutes) || input.estimatedMinutes < 1 || input.estimatedMinutes > 1440) {
      throw new ValidationError("Expected time must be between 1 and 1440 minutes.");
    }
  }
  if (input.departmentId) {
    const department = await getDepartmentById(businessId, input.departmentId);
    if (!department) throw new NotFoundError("Department");
  }
  return out;
}

/**
 * Staff-facing service management (project instructions section 8 Step 4).
 * A Service is what a guest actually picks from in the portal
 * (`listActiveServicesForBusiness`) — this module is how it gets there.
 */
export async function createService(
  actor: StaffActor,
  input: Omit<CreateServiceInput, "businessId">,
) {
  assertAuthorized({
    actor,
    action: "service:manage",
    resource: { businessId: actor.businessId },
  });

  const clean = await validateServiceFields(actor.businessId, input);
  const name = clean.name ?? "";

  const service = await repo.createService({
    ...input,
    ...clean,
    businessId: actor.businessId,
    name,
  });

  await logAudit(actor, {
    action: "service.created",
    entityType: "Service",
    entityId: service.id,
    newValue: { name, departmentId: input.departmentId ?? null },
  });

  return service;
}

export async function setServiceActive(actor: StaffActor, serviceId: string, isActive: boolean) {
  assertAuthorized({
    actor,
    action: "service:manage",
    resource: { businessId: actor.businessId },
  });

  const result = await repo.setServiceActive(actor.businessId, serviceId, isActive);
  if (result.count === 0) throw new NotFoundError("Service");

  await logAudit(actor, {
    action: isActive ? "service.activated" : "service.deactivated",
    entityType: "Service",
    entityId: serviceId,
  });

  return result;
}

export async function updateService(actor: StaffActor, serviceId: string, patch: UpdateServiceInput) {
  assertAuthorized({ actor, action: "service:manage", resource: { businessId: actor.businessId } });
  const current = await repo.getServiceById(actor.businessId, serviceId);
  if (!current) throw new NotFoundError("Service");

  const clean = await validateServiceFields(actor.businessId, patch);
  const result = await repo.updateService(actor.businessId, serviceId, clean);
  if (result.count === 0) throw new NotFoundError("Service");

  await logAudit(actor, {
    action: "service.updated",
    entityType: "Service",
    entityId: serviceId,
    oldValue: {
      name: current.name,
      departmentId: current.departmentId,
      defaultPriority: current.defaultPriority,
      estimatedMinutes: current.estimatedMinutes,
      icon: current.icon,
    },
    newValue: clean as Record<string, unknown>,
  });
  return result;
}
