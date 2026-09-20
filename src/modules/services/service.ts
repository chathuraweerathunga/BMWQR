import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/modules/audit/service";
import { getDepartmentById } from "@/modules/departments/repository";
import * as repo from "./repository";
import type { CreateServiceInput } from "./repository";

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

  const name = input.name.trim();
  if (!name) throw new ValidationError("Service name is required.");

  if (input.departmentId) {
    const department = await getDepartmentById(actor.businessId, input.departmentId);
    if (!department) throw new NotFoundError("Department");
  }

  const service = await repo.createService({
    ...input,
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
