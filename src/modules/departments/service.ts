import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";

/**
 * Staff-facing department management (project instructions section 8 Step
 * 5). Departments are the routing target for requests/services — a small,
 * flat list per business, not a hierarchy, so this module stays
 * deliberately simple (create/list/rename) rather than adding a status or
 * archive concept the schema doesn't have yet.
 */
export async function createDepartment(
  actor: StaffActor,
  input: { name: string; description?: string | null },
) {
  assertAuthorized({
    actor,
    action: "department:manage",
    resource: { businessId: actor.businessId },
  });

  const name = input.name.trim();
  if (!name) throw new ValidationError("Department name is required.");

  const existing = await repo.getDepartmentByName(actor.businessId, name);
  if (existing) throw new ValidationError("A department with that name already exists.");

  const department = await repo.createDepartment(actor.businessId, {
    name,
    description: input.description ?? null,
  });

  await logAudit(actor, {
    action: "department.created",
    entityType: "Department",
    entityId: department.id,
    newValue: { name, description: input.description ?? null },
  });

  return department;
}

export async function updateDepartment(
  actor: StaffActor,
  departmentId: string,
  patch: { name?: string; description?: string | null },
) {
  assertAuthorized({
    actor,
    action: "department:manage",
    resource: { businessId: actor.businessId },
  });

  const current = await repo.getDepartmentById(actor.businessId, departmentId);
  if (!current) throw new NotFoundError("Department");

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new ValidationError("Department name is required.");
    if (name !== current.name) {
      const existing = await repo.getDepartmentByName(actor.businessId, name);
      if (existing) throw new ValidationError("A department with that name already exists.");
    }
    patch = { ...patch, name };
  }

  const result = await repo.updateDepartment(actor.businessId, departmentId, patch);
  if (result.count === 0) throw new NotFoundError("Department");

  await logAudit(actor, {
    action: "department.updated",
    entityType: "Department",
    entityId: departmentId,
    oldValue: { name: current.name, description: current.description },
    newValue: patch,
  });

  return result;
}
